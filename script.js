// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
// CONFIG is now in DASHBOARD_DATA
const days = ['Oct 13', 'Oct 14', 'Oct 15', 'Oct 16', 'Oct 17', 'Oct 18', 'Oct 19'];

// State
let state = {
    metric: 'Revenue',
    groupFilter: 'All',
    drillChannel: null // If set, we drill into Sub-Channels
};

let rawData = [];
let trendChart, barChart, productChart, contributionChart;

// ==========================================
// 2. MOCK DATA ENGINE
// ==========================================
// Data is loaded from data.js into the global variable DASHBOARD_DATA

function initData() {
    rawData = [];
    // Access the global variable defined in data.js
    const { products: PRODUCTS, hierarchy } = DASHBOARD_DATA;

    // Config
    const CONFIG = DASHBOARD_DATA.config; // If we need to access config elsewhere

    days.forEach((day, dIndex) => {
        Object.keys(hierarchy).forEach(group => {
            Object.keys(hierarchy[group]).forEach(channel => {
                hierarchy[group][channel].forEach(sub => {

                    // Get Product preferences for this channel
                    let profile = getMixProfile(channel);

                    // Base Volume Logic - Adjusted for desired distribution
                    // Target: WEB ~25%, APP ~20%, TVM ~35%, Others ~20%
                    let baseOrders = Math.floor(Math.random() * 50) + 10;

                    // Channel-specific multipliers
                    if (channel === 'TVM') baseOrders *= 35;
                    else if (channel === 'WEB') baseOrders *= 25;
                    else if (channel === 'APP') baseOrders *= 20;
                    else if (channel === 'B2B') baseOrders *= 8;
                    else if (channel === 'Zettle') baseOrders *= 4;
                    else if (channel === 'Flygtaxi') baseOrders *= 3;
                    else if (channel === 'Samtrafiken') baseOrders *= 3;
                    else if (channel === 'SAS') baseOrders *= 2;

                    // Weekend adjustments
                    if (dIndex > 4 && channel === 'B2B') baseOrders *= 0.1;
                    if (dIndex > 4 && ['WEB', 'APP'].includes(channel)) baseOrders *= 1.3;

                    Object.keys(PRODUCTS).forEach(cat => {
                        PRODUCTS[cat].forEach(prod => {
                            // Probabilistic Sales Generation
                            const prob = profile[prod.name] || 0.01;
                            const qty = Math.floor(baseOrders * prob * (Math.random() * 0.4 + 0.8));

                            const rev = qty * prod.price;
                            const pax = qty * prod.paxCount;

                            const growth = 1.15 + (Math.random() * 0.1 - 0.05); // ~15% growth (above airport 12.5%)

                            rawData.push({
                                dIndex, day, group, channel, sub,
                                productName: prod.name,
                                productCat: prod.cat,
                                cy: { Revenue: rev, PAX: pax, Orders: qty },
                                py: { Revenue: rev / growth, PAX: pax / growth, Orders: qty / growth }
                            });
                        });
                    });
                });
            });
        });
    });
}

function getMixProfile(channel) {
    // Define what products sell in which channel
    if (channel === 'WEB' || channel === 'APP') {
        return { '2 för': 0.3, '3 för': 0.15, '4 för': 0.1, 'Vuxen Enkel': 0.25, 'Ungdom': 0.2 };
    }
    if (channel === 'TVM' || channel === 'Zettle') {
        return { 'Vuxen Enkel': 0.6, 'Vuxen T&R': 0.3, 'Pensionär': 0.1 };
    }
    if (channel === 'B2B') {
        return { 'Resepott': 0.15, 'Vuxen Enkel': 0.8 };
    }
    return { 'Vuxen Enkel': 0.9, 'Vuxen T&R': 0.1 };
}

// ==========================================
// 3. AGGREGATION LOGIC
// ==========================================
function getAggregates() {
    // 1. Filter Data based on UI controls
    const subset = rawData.filter(d => {
        const gMatch = state.groupFilter === 'All' || d.group === state.groupFilter;
        const cMatch = !state.drillChannel || d.channel === state.drillChannel;
        return gMatch && cMatch;
    });

    // 2. Prepare containers
    let kpi = { cy: { Revenue: 0, PAX: 0, Orders: 0 }, py: { Revenue: 0, PAX: 0, Orders: 0 } };
    let trend = days.map(() => ({ cy: 0, py: 0 }));
    let channelMix = {}; // This populates the Bar Chart
    let productMix = days.map(() => ({ 'Standard': 0, 'Group': 0, 'Discount': 0, 'Commuter': 0 })); // Stacked Bar (Orders)
    let channelContribution = {}; // Channel contribution to total revenue

    subset.forEach(d => {
        // KPIs
        kpi.cy.Revenue += d.cy.Revenue; kpi.cy.PAX += d.cy.PAX; kpi.cy.Orders += d.cy.Orders;
        kpi.py.Revenue += d.py.Revenue; kpi.py.PAX += d.py.PAX; kpi.py.Orders += d.py.Orders;

        // Trend
        trend[d.dIndex].cy += d.cy[state.metric];
        trend[d.dIndex].py += d.py[state.metric];

        // Channel/Drill Chart Logic
        // If NO drill -> Group by Channel
        // If YES drill -> Group by Sub-Channel
        const dimKey = state.drillChannel ? d.sub : d.channel;
        if (!channelMix[dimKey]) channelMix[dimKey] = 0;
        channelMix[dimKey] += d.cy[state.metric];

        // Product Mix Logic (Orders instead of Revenue)
        productMix[d.dIndex][d.productCat] += d.cy.Orders;

        // Channel Contribution to Revenue
        if (!channelContribution[d.channel]) channelContribution[d.channel] = 0;
        channelContribution[d.channel] += d.cy.Revenue;
    });

    // XCOM Executive Summary - Group channels
    let xcomGroups = {
        'WEB': { cy: { Revenue: 0, PAX: 0, Orders: 0 }, py: { Revenue: 0, PAX: 0, Orders: 0 } },
        'APP': { cy: { Revenue: 0, PAX: 0, Orders: 0 }, py: { Revenue: 0, PAX: 0, Orders: 0 } },
        'TVM': { cy: { Revenue: 0, PAX: 0, Orders: 0 }, py: { Revenue: 0, PAX: 0, Orders: 0 } },
        'Partner': { cy: { Revenue: 0, PAX: 0, Orders: 0 }, py: { Revenue: 0, PAX: 0, Orders: 0 } },
        'SAS': { cy: { Revenue: 0, PAX: 0, Orders: 0 }, py: { Revenue: 0, PAX: 0, Orders: 0 } }
    };

    rawData.forEach(d => {
        // Group channels into XCOM categories
        let xcomCategory = null;
        if (d.channel === 'WEB') {
            xcomCategory = 'WEB';
        } else if (d.channel === 'APP') {
            xcomCategory = 'APP';
        } else if (d.channel === 'TVM') {
            xcomCategory = 'TVM';
        } else if (d.channel === 'SAS' || (d.group === 'Partner' && d.channel === 'SAS')) {
            xcomCategory = 'SAS';
        } else if (d.group === 'Partner' && d.channel !== 'SAS') {
            xcomCategory = 'Partner';
        }

        if (xcomCategory) {
            xcomGroups[xcomCategory].cy.Revenue += d.cy.Revenue;
            xcomGroups[xcomCategory].cy.PAX += d.cy.PAX;
            xcomGroups[xcomCategory].cy.Orders += d.cy.Orders;
            xcomGroups[xcomCategory].py.Revenue += d.py.Revenue;
            xcomGroups[xcomCategory].py.PAX += d.py.PAX;
            xcomGroups[xcomCategory].py.Orders += d.py.Orders;
        }
    });

    // Global Totals for Market Share Context
    let globalPax = { cy: 0, py: 0 };
    rawData.forEach(d => { globalPax.cy += d.cy.PAX; globalPax.py += d.py.PAX; });

    return { kpi, trend, channelMix, productMix, channelContribution, xcomGroups, globalPax };
}

// ==========================================
// 4. RENDERING
// ==========================================
function updateDashboard() {
    state.groupFilter = document.getElementById('groupFilter').value;
    const data = getAggregates();

    renderContext(data.kpi, data.globalPax);
    renderKPIs(data.kpi);
    renderMainCharts(data);
    renderProductMixChart(data.productMix);
    renderChannelContributionChart(data.channelContribution, data.kpi.cy.Revenue);
    renderXCOMView(data.xcomGroups, data.globalPax);

    // Dynamic Titles
    const drillTitle = state.drillChannel ? `${state.drillChannel} Sub-Channels` : `Sales Channel Mix`;
    document.getElementById('breakdown-title').innerText = drillTitle;
    document.getElementById('trend-title').innerText = `Weekly ${state.metric} Trend`;
}

function renderContext(kpi, globalPax) {
    const AIRPORT_GROWTH_PCT = DASHBOARD_DATA.config.AIRPORT_GROWTH_PCT;

    // Context Logic
    const airportPy = globalPax.py * 5;
    const airportCy = airportPy * (1 + (AIRPORT_GROWTH_PCT / 100));

    const shareCy = (globalPax.cy / airportCy) * 100;
    const sharePy = (globalPax.py / airportPy) * 100;
    const shareDelta = shareCy - sharePy;

    document.getElementById('ctx-share').innerText = shareCy.toFixed(1) + '%';
    document.getElementById('ctx-share-delta').innerHTML = `<span class="${shareDelta >= 0 ? 'text-green-600' : 'text-red-600'} font-bold">${shareDelta > 0 ? '+' : ''}${shareDelta.toFixed(2)} pp</span> vs PY`;

    const entityGrowth = kpi.py.PAX > 0 ? ((kpi.cy.PAX - kpi.py.PAX) / kpi.py.PAX) * 100 : 0;
    const gap = entityGrowth - AIRPORT_GROWTH_PCT;

    const elGap = document.getElementById('ctx-gap');
    elGap.innerText = `${gap > 0 ? '+' : ''}${gap.toFixed(1)} pp`;
    elGap.className = `text-3xl font-bold ${gap >= 0 ? 'text-green-600' : 'text-red-600'}`;
}

function renderKPIs(kpi) {
    const fmt = (n) => new Intl.NumberFormat('sv-SE').format(Math.round(n));
    const renderVar = (c, p, id) => {
        if (p === 0) return;
        const pct = ((c - p) / p) * 100;
        const el = document.getElementById(id);
        el.innerHTML = `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`;
        el.className = pct >= 0 ? 'var-pos' : 'var-neg';
    };

    document.getElementById('kpi-rev').innerText = fmt(kpi.cy.Revenue);
    renderVar(kpi.cy.Revenue, kpi.py.Revenue, 'var-rev');

    document.getElementById('kpi-orders').innerText = fmt(kpi.cy.Orders);
    renderVar(kpi.cy.Orders, kpi.py.Orders, 'var-orders');

    document.getElementById('kpi-pax').innerText = fmt(kpi.cy.PAX);
    renderVar(kpi.cy.PAX, kpi.py.PAX, 'var-pax');

    const yC = kpi.cy.PAX ? kpi.cy.Revenue / kpi.cy.PAX : 0;
    const yP = kpi.py.PAX ? kpi.py.Revenue / kpi.py.PAX : 0;
    document.getElementById('kpi-yield').innerText = yC.toFixed(1);
    renderVar(yC, yP, 'var-yield');

    const aC = kpi.cy.Orders ? kpi.cy.Revenue / kpi.cy.Orders : 0;
    const aP = kpi.py.Orders ? kpi.py.Revenue / kpi.py.Orders : 0;
    document.getElementById('kpi-aov').innerText = aC.toFixed(0);
    renderVar(aC, aP, 'var-aov');
}

function renderMainCharts(data) {
    // TREND
    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                { label: 'Current Year', data: data.trend.map(t => t.cy), borderColor: '#FDB913', backgroundColor: 'rgba(253,185,19,0.1)', fill: true, tension: 0.4, borderWidth: 3 },
                { label: 'Prior Year', data: data.trend.map(t => t.py), borderColor: '#9ca3af', borderDash: [5, 5], fill: false, tension: 0.4, borderWidth: 2 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } }
    });

    // BAR (Drill Down)
    const ctxBar = document.getElementById('barChart').getContext('2d');
    const labels = Object.keys(data.channelMix);
    const vals = Object.values(data.channelMix);
    if (barChart) barChart.destroy();

    barChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: state.metric, data: vals, backgroundColor: state.drillChannel ? '#3b82f6' : '#FDB913', borderRadius: 4 }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            onClick: (e, els) => { if (els.length > 0) drillDown(labels[els[0].index]); },
            onHover: (e, el) => e.native.target.style.cursor = el[0] ? 'pointer' : 'default',
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { grid: { display: false } } }
        }
    });
}

function renderProductMixChart(mixData) {
    const ctx = document.getElementById('productMixChart').getContext('2d');
    if (productChart) productChart.destroy();

    productChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [
                { label: 'Standard', data: mixData.map(d => d.Standard), backgroundColor: '#FDB913' },
                { label: 'Group', data: mixData.map(d => d.Group), backgroundColor: '#3b82f6' },
                { label: 'Discount', data: mixData.map(d => d.Discount), backgroundColor: '#9ca3af' },
                { label: 'Commuter', data: mixData.map(d => d.Commuter), backgroundColor: '#10b981' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true } },
            plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }
        }
    });
}

function renderChannelContributionChart(contributionData, totalRevenue) {
    const ctx = document.getElementById('channelContributionChart').getContext('2d');
    if (contributionChart) contributionChart.destroy();

    // Sort by revenue and calculate percentages
    const sortedChannels = Object.keys(contributionData).sort((a, b) => contributionData[b] - contributionData[a]);
    const values = sortedChannels.map(ch => contributionData[ch]);
    const percentages = sortedChannels.map(ch => ((contributionData[ch] / totalRevenue) * 100).toFixed(1));

    // Color palette for channels
    const colors = ['#FDB913', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

    contributionChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: sortedChannels.map((ch, i) => `${ch} (${percentages[i]}%)`),
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, sortedChannels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const value = new Intl.NumberFormat('sv-SE').format(Math.round(context.parsed));
                            return `${context.label}: ${value} SEK`;
                        }
                    }
                }
            }
        }
    });
}

function renderXCOMView(xcomGroups, globalPax) {
    const AIRPORT_GROWTH_PCT = DASHBOARD_DATA.config.AIRPORT_GROWTH_PCT;

    // Calculate airport context
    const airportPy = globalPax.py * 5;
    const airportCy = airportPy * (1 + (AIRPORT_GROWTH_PCT / 100));
    const aexShareCy = (globalPax.cy / airportCy) * 100;

    // Render each channel group
    ['WEB', 'APP', 'TVM', 'Partner', 'SAS'].forEach(groupName => {
        const group = xcomGroups[groupName];

        // Revenue
        const revEl = document.getElementById(`xcom-${groupName.toLowerCase()}-rev`);
        if (revEl) {
            const revGrowth = group.py.Revenue > 0 ? ((group.cy.Revenue - group.py.Revenue) / group.py.Revenue) * 100 : 0;
            const growthColor = revGrowth >= 0 ? 'text-green-600' : 'text-red-600';
            const arrow = revGrowth >= 0 ? '▲' : '▼';
            revEl.innerHTML = `
                <div class="text-gray-900">${new Intl.NumberFormat('sv-SE').format(Math.round(group.cy.Revenue))}</div>
                <div class="text-xs mt-1 ${growthColor}">${arrow} ${Math.abs(revGrowth).toFixed(1)}%</div>
            `;
        }

        // PAX
        const paxEl = document.getElementById(`xcom-${groupName.toLowerCase()}-pax`);
        if (paxEl) {
            const paxGrowth = group.py.PAX > 0 ? ((group.cy.PAX - group.py.PAX) / group.py.PAX) * 100 : 0;
            const growthColor = paxGrowth >= 0 ? 'text-green-600' : 'text-red-600';
            const arrow = paxGrowth >= 0 ? '▲' : '▼';
            paxEl.innerHTML = `
                <div class="text-gray-900">${new Intl.NumberFormat('sv-SE').format(Math.round(group.cy.PAX))}</div>
                <div class="text-xs mt-1 ${growthColor}">${arrow} ${Math.abs(paxGrowth).toFixed(1)}%</div>
            `;
        }

        // Orders
        const ordEl = document.getElementById(`xcom-${groupName.toLowerCase()}-orders`);
        if (ordEl) {
            const ordGrowth = group.py.Orders > 0 ? ((group.cy.Orders - group.py.Orders) / group.py.Orders) * 100 : 0;
            const growthColor = ordGrowth >= 0 ? 'text-green-600' : 'text-red-600';
            const arrow = ordGrowth >= 0 ? '▲' : '▼';
            ordEl.innerHTML = `
                <div class="text-gray-900">${new Intl.NumberFormat('sv-SE').format(Math.round(group.cy.Orders))}</div>
                <div class="text-xs mt-1 ${growthColor}">${arrow} ${Math.abs(ordGrowth).toFixed(1)}%</div>
            `;
        }

        // Performance vs Airport
        const perfEl = document.getElementById(`xcom-${groupName.toLowerCase()}-perf`);
        if (perfEl) {
            const paxGrowth = group.py.PAX > 0 ? ((group.cy.PAX - group.py.PAX) / group.py.PAX) * 100 : 0;
            const gap = paxGrowth - AIRPORT_GROWTH_PCT;
            const gapColor = gap >= 0 ? 'text-green-600' : 'text-red-600';
            perfEl.innerHTML = `
                <div class="${gapColor}">${gap > 0 ? '+' : ''}${gap.toFixed(1)} pp</div>
            `;
        }

        // Market Share Contribution
        const shareEl = document.getElementById(`xcom-${groupName.toLowerCase()}-share`);
        if (shareEl) {
            const contribution = (group.cy.PAX / globalPax.cy) * 100;
            shareEl.innerHTML = `
                <div class="text-gray-900">${contribution.toFixed(1)}%</div>
            `;
        }

        // Contribution to AEX Market Share
        const mktShareEl = document.getElementById(`xcom-${groupName.toLowerCase()}-mktshare`);
        if (mktShareEl) {
            const airportPy = globalPax.py * 5;
            const airportCy = airportPy * (1 + (AIRPORT_GROWTH_PCT / 100));

            // This channel group's contribution to AEX's overall market share
            const groupShareOfAirport = (group.cy.PAX / airportCy) * 100;

            mktShareEl.innerHTML = `
                <div class="text-blue-600">${groupShareOfAirport.toFixed(2)}%</div>
            `;
        }
    });
}

// ==========================================
// 5. INTERACTIONS
// ==========================================
function drillDown(label) {
    // Only drill if the label is a Channel (not a sub-channel)
    const isChannel = Object.values(DASHBOARD_DATA.hierarchy).some(g => Object.keys(g).includes(label));

    if (isChannel) {
        state.drillChannel = label;
        updateDashboard();
    }
}

function resetView() {
    state.drillChannel = null;
    state.groupFilter = 'All';
    document.getElementById('groupFilter').value = 'All';
    updateDashboard();
}

function setMetric(m) {
    state.metric = m;
    ['Revenue', 'Orders', 'PAX'].forEach(id => {
        const el = document.getElementById('btn-' + id);
        el.className = (id === m) ? 'tab-btn tab-active px-3 py-1 rounded-full text-xs shadow-sm' : 'tab-btn tab-inactive px-3 py-1 rounded-full text-xs shadow-sm';
    });
    updateDashboard();
}

// Auto Init on Load
initData();
updateDashboard();
