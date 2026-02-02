// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
// CONFIG is now in DASHBOARD_DATA
const days = ['Oct 13', 'Oct 14', 'Oct 15', 'Oct 16', 'Oct 17', 'Oct 18', 'Oct 19'];

let state = {
    metric: 'Revenue',
    path: [] // Navigation path: e.g. ['Partner', 'B2B']
};

let rawData = [];
// Product chart logic removed

// ==========================================
// 2. MOCK DATA ENGINE
// ==========================================
// Data is loaded from data.js into the global variable DASHBOARD_DATA

function initData() {
    rawData = [];
    // Access the global variable defined in data.js
    console.log('Loading Dashboard Data v', DASHBOARD_DATA.config.DATA_VERSION);
    const { products: PRODUCTS, hierarchy } = DASHBOARD_DATA;

    // Config
    const CONFIG = DASHBOARD_DATA.config; // If we need to access config elsewhere

    days.forEach((day, dIndex) => {
        Object.keys(hierarchy).forEach(group => {
            Object.keys(hierarchy[group]).forEach(channel => {
                const channelData = hierarchy[group][channel];

                // Helper to process a sub-channel
                const processSub = (sub, leafVal) => {
                    const leaf = leafVal || sub;

                    // Get Product preferences for this channel
                    let profile = getMixProfile(channel);

                    // Base Volume Logic - Adjusted for desired distribution
                    // Target: WEB ~25%, APP ~20%, TVM ~35%, Others ~20%
                    let baseOrders = Math.floor(Math.random() * 50) + 10;

                    // Channel-specific multipliers
                    if (channel === 'TVM') baseOrders *= 35;
                    else if (channel === 'WEB') baseOrders *= 25;
                    else if (channel === 'APP') baseOrders *= 20;
                    else if (channel === 'ARN') baseOrders *= 5;

                    // Partner Channels
                    else if (channel === 'Airlines') baseOrders *= 4;
                    else if (channel === 'B2B') baseOrders *= 8;
                    else if (channel === 'Flygtaxi') baseOrders *= 3;
                    else if (channel === 'Samtrafiken') baseOrders *= 3;

                    // Sub-channel variations
                    if (sub === 'SAS') baseOrders *= 1.5;
                    if (sub === 'Norwegian') baseOrders *= 0.5;
                    if (sub === 'Amex') baseOrders *= 0.8;
                    if (sub === 'Omni') baseOrders *= 0.2;
                    if (sub === 'SvenskaSpel') baseOrders *= 0.1;

                    // Leaf variations (B2B Deep Dive)
                    if (leaf === 'Polisen') baseOrders *= 0.6;
                    if (leaf === 'Myndighet') baseOrders *= 0.4;
                    if (leaf === 'Martin & Servera') baseOrders *= 0.7;
                    if (leaf === 'Svenska Spel') baseOrders *= 0.3;
                    if (leaf === 'Mcinsey') baseOrders *= 0.5;
                    if (leaf === 'eventX') baseOrders *= 0.5;

                    // Weekend adjustments
                    // B2B subs logic
                    if (dIndex > 4 && channel === 'B2B') baseOrders *= 0.1;

                    // Airlines adjustments
                    if (dIndex > 4 && channel === 'Airlines') baseOrders *= 0.6; // Less business travel?

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
                                dIndex, day, group, channel, sub, leaf,
                                productName: prod.name,
                                productCat: prod.cat,
                                cy: { Revenue: rev, PAX: pax, Orders: qty },
                                py: { Revenue: rev / growth, PAX: pax / growth, Orders: qty / growth }
                            });
                        });
                    });
                };

                // Handle Array vs Object structure
                if (Array.isArray(channelData)) {
                    channelData.forEach(sub => processSub(sub, null));
                } else {
                    // Object (B2B deep structure)
                    Object.keys(channelData).forEach(sub => {
                        channelData[sub].forEach(leaf => processSub(sub, leaf));
                    });
                }
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
// ==========================================
// 3. AGGREGATION LOGIC
// ==========================================
function getNodeChildren(path) {
    const HIERARCHY = DASHBOARD_DATA.hierarchy; // Access via global DASHBOARD_DATA which initData ensures exists
    const TOP_LEVEL = ['WEB', 'APP', 'TVM', 'ARN', 'Partner'];

    if (path.length === 0) return TOP_LEVEL;

    // Navigate hierarchy
    // Root -> Partner -> B2B

    // Level 0: Root
    const level0 = path[0];
    if (path.length === 1) {
        if (level0 === 'Partner') {
            return Object.keys(HIERARCHY.Partner);
        }
        // Direct channels have no sub-cards in this specific view logic unless we want to
        // If user clicks WEB, we might show Campaigns etc. 
        // For now, let's assume standard behavior for Direct keys if they exist in Hierarchy
        if (HIERARCHY.Direct && HIERARCHY.Direct[level0]) return HIERARCHY.Direct[level0];
    }

    // Level 1+: Partner -> B2B
    if (path.length === 2 && level0 === 'Partner') {
        const level1 = path[1];
        const node = HIERARCHY.Partner[level1];
        if (Array.isArray(node)) return node; // e.g. SAS, Norwegian
        if (typeof node === 'object') return Object.keys(node); // e.g. Distributor web
    }

    // Level 2+: Partner -> B2B -> Distributor web
    if (path.length === 3 && level0 === 'Partner') {
        const level1 = path[1];
        const level2 = path[2];
        const node = HIERARCHY.Partner[level1][level2];
        if (Array.isArray(node)) return node;
    }

    return [];
}

function classifyRow(d, path) {
    // Returns the key this row belongs to for the current path
    // e.g. if path=[], row.channel=Zettle -> 'Partner'
    // e.g. if path=['Partner'], row.channel=Flygtaxi -> 'Flygtaxi'

    if (path.length === 0) {
        if (['WEB', 'APP', 'TVM', 'ARN'].includes(d.channel)) return d.channel;
        return 'Partner';
    }

    const level0 = path[0];

    if (level0 === 'Partner') {
        if (path.length === 1) {
            // Inside Partner: return row.channel (e.g. Airlines, B2B...)
            return d.channel;
        }
        if (path.length === 2) {
            // Inside Partner -> B2B: return row.sub (e.g. Distributor web)
            // or Partner -> Airlines: return row.sub (e.g. SAS)
            return d.sub;
        }
        if (path.length === 3) {
            // Inside Partner -> B2B -> Dist: return row.leaf
            return d.leaf;
        }
    }

    // Direct Channel Drill (if supported in future)
    if (['WEB', 'APP', 'TVM', 'ARN'].includes(level0)) {
        if (path.length === 1) return d.sub;
    }

    return null;
}

function getAggregates() {
    // 1. Determine active children nodes
    const activeNodes = getNodeChildren(state.path);

    // 2. Prepare containers
    let kpi = { cy: { Revenue: 0, PAX: 0, Orders: 0 }, py: { Revenue: 0, PAX: 0, Orders: 0 } };
    let productMix = days.map(() => ({ 'Standard': 0, 'Group': 0, 'Discount': 0, 'Commuter': 0 }));

    // Dynamic Groups for Cards
    let groups = {};
    activeNodes.forEach(name => {
        groups[name] = {
            cy: { Revenue: 0, PAX: 0, Orders: 0 },
            py: { Revenue: 0, PAX: 0, Orders: 0 }
        };
    });

    // 3. Aggregate
    rawData.forEach(d => {
        // Global KPIS (Always total, or filtered?)
        // Usually KPIs reflect the CURRENT VIEW.

        let inView = true;
        // Check if row belongs to current path
        if (state.path.length > 0) {
            const root = state.path[0];
            if (root === 'Partner') {
                if (['WEB', 'APP', 'TVM', 'ARN'].includes(d.channel)) inView = false;
                else {
                    // Check deeper levels
                    if (state.path.length > 1 && d.channel !== state.path[1]) inView = false;
                    if (state.path.length > 2 && d.sub !== state.path[2]) inView = false;
                }
            } else {
                // Direct drill
                if (d.channel !== root) inView = false;
            }
        }

        if (!inView) return;

        // Add to KPIs
        kpi.cy.Revenue += d.cy.Revenue; kpi.cy.PAX += d.cy.PAX; kpi.cy.Orders += d.cy.Orders;
        kpi.py.Revenue += d.py.Revenue; kpi.py.PAX += d.py.PAX; kpi.py.Orders += d.py.Orders;

        // Add to Product Mix
        if (d.productCat && productMix[d.dIndex]) {
            productMix[d.dIndex][d.productCat] += d.cy.Orders;
        }

        // Group into Cards
        const bucket = classifyRow(d, state.path);
        if (bucket && groups[bucket]) {
            groups[bucket].cy.Revenue += d.cy.Revenue;
            groups[bucket].cy.PAX += d.cy.PAX;
            groups[bucket].cy.Orders += d.cy.Orders;
            groups[bucket].py.Revenue += d.py.Revenue;
            groups[bucket].py.PAX += d.py.PAX;
            groups[bucket].py.Orders += d.py.Orders;
        }
    });

    // Global Totals for Market Share Context (Always Total Airport)
    let globalPax = { cy: 0, py: 0 };
    rawData.forEach(d => { globalPax.cy += d.cy.PAX; globalPax.py += d.py.PAX; });

    return { kpi, productMix, groups, globalPax };
}

// ==========================================
// 4. RENDERING
// ==========================================
function updateDashboard() {
    state.groupFilter = 'All';
    const data = getAggregates();

    renderContext(data.kpi, data.globalPax);
    renderKPIs(data.kpi);
    renderXCOMCards(data.groups, data.globalPax);
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

// DELETED TREND AND BAR CHART LOGIC


// DELETED TREND AND BAR CHART LOGIC


function renderXCOMCards(groups, globalPax) {
    const AIRPORT_GROWTH_PCT = DASHBOARD_DATA.config.AIRPORT_GROWTH_PCT;
    const MARKET_SHARE_TARGET = DASHBOARD_DATA.config.MARKET_SHARE_TARGET;
    const MARKET_SHARE_BUDGET = DASHBOARD_DATA.config.MARKET_SHARE_BUDGET;

    // Defined Target Mix (Assumed for breakdown)
    const TARGET_MIX_PCT = { 'WEB': 25, 'APP': 20, 'TVM': 35, 'ARN': 5, 'Partner': 15 };

    // Calculate airport context
    const airportPy = globalPax.py * 5; // Simplified assumption
    const airportCy = airportPy * (1 + (AIRPORT_GROWTH_PCT / 100));
    const aexShareCy = (globalPax.cy / airportCy) * 100;

    const grid = document.getElementById('xcom-grid');
    grid.innerHTML = ''; // Clear existing

    // Loop through dynamic groups
    Object.keys(groups).forEach(groupName => {
        const group = groups[groupName];

        // Skip empty groups if any
        if (!group) return;

        // Border Colors based on group name
        let borderColor = 'border-gray-400';
        let icon = 'fa-chart-bar';
        let iconColor = 'text-gray-600';

        // Heuristic styling
        if (groupName === 'WEB') { borderColor = 'border-blue-500'; icon = 'fa-globe'; iconColor = 'text-blue-500'; }
        if (groupName === 'APP') { borderColor = 'border-indigo-500'; icon = 'fa-mobile-alt'; iconColor = 'text-indigo-500'; }
        if (groupName === 'TVM') { borderColor = 'border-yellow-400'; icon = 'fa-desktop'; iconColor = 'text-yellow-600'; }
        if (groupName === 'ARN') { borderColor = 'border-orange-500'; icon = 'fa-store'; iconColor = 'text-orange-500'; }
        if (groupName === 'Partner') { borderColor = 'border-green-500'; icon = 'fa-handshake'; iconColor = 'text-green-600'; }

        // Metrics Calculations
        const revGrowth = group.py.Revenue > 0 ? ((group.cy.Revenue - group.py.Revenue) / group.py.Revenue) * 100 : 0;
        const paxGrowth = group.py.PAX > 0 ? ((group.cy.PAX - group.py.PAX) / group.py.PAX) * 100 : 0;
        const ordGrowth = group.py.Orders > 0 ? ((group.cy.Orders - group.py.Orders) / group.py.Orders) * 100 : 0;

        const yieldVal = group.cy.PAX > 0 ? group.cy.Revenue / group.cy.PAX : 0;
        const yieldPy = group.py.PAX > 0 ? group.py.Revenue / group.py.PAX : 0;
        const yieldGrowth = yieldPy > 0 ? ((yieldVal - yieldPy) / yieldPy) * 100 : 0;

        const aovVal = group.cy.Orders > 0 ? group.cy.Revenue / group.cy.Orders : 0;
        const aovPy = group.py.Orders > 0 ? group.py.Revenue / group.py.Orders : 0;
        const aovGrowth = aovPy > 0 ? ((aovVal - aovPy) / aovPy) * 100 : 0;

        // Share Analysis
        // For sub-levels, showing Share vs Total Airport is still valid context, 
        // or Share of Parent. Let's stick to Share of Total Airport for simplified view.
        const shareCy = (group.cy.PAX / airportCy) * 100;
        const sharePy = (group.py.PAX / airportPy) * 100;
        const diffPy = shareCy - sharePy;

        // Simplify formatting helpers
        const fmt = (n) => new Intl.NumberFormat('sv-SE').format(Math.round(n));
        const arr = (g) => g >= 0 ? '▲' : '▼';
        const col = (g) => g >= 0 ? 'text-green-600' : 'text-red-600';

        const card = document.createElement('div');
        card.className = `card border-l-4 ${borderColor} cursor-pointer hover:shadow-md transition-shadow`;
        card.onclick = () => drill(groupName);

        card.innerHTML = `
            <div class="mb-3 pb-2 border-b border-gray-100 flex justify-between items-start">
                <div>
                    <div class="flex items-center gap-2">
                        <i class="fas ${icon} ${iconColor} text-sm"></i>
                        <h3 class="font-bold text-gray-900 text-sm">${groupName}</h3>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">Click to drill down</p>
                </div>
                <i class="fas fa-chevron-right text-gray-300 text-xs mt-1"></i>
            </div>

            <div class="space-y-3">
                <div>
                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Revenue</p>
                    <div class="text-gray-900 font-bold text-lg">${fmt(group.cy.Revenue)}</div>
                    <div class="text-xs ${col(revGrowth)}">${arr(revGrowth)} ${Math.abs(revGrowth).toFixed(1)}%</div>
                </div>
                <div>
                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">PAX</p>
                    <div class="text-gray-900 font-bold text-lg">${fmt(group.cy.PAX)}</div>
                     <div class="text-xs ${col(paxGrowth)}">${arr(paxGrowth)} ${Math.abs(paxGrowth).toFixed(1)}%</div>
                </div>
                <div>
                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Orders</p>
                    <div class="text-gray-900 font-bold text-lg">${fmt(group.cy.Orders)}</div>
                     <div class="text-xs ${col(ordGrowth)}">${arr(ordGrowth)} ${Math.abs(ordGrowth).toFixed(1)}%</div>
                </div>
                <!-- Compact Grid for Yield/AOV -->
                <div class="grid grid-cols-2 gap-2">
                     <div>
                        <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Yield</p>
                        <div class="text-gray-900 font-bold">${Math.round(yieldVal)}</div>
                        <div class="text-xs ${col(yieldGrowth)}">${arr(yieldGrowth)} ${Math.abs(yieldGrowth).toFixed(1)}%</div>
                     </div>
                     <div>
                        <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">AOV</p>
                        <div class="text-gray-900 font-bold">${Math.round(aovVal)}</div>
                        <div class="text-xs ${col(aovGrowth)}">${arr(aovGrowth)} ${Math.abs(aovGrowth).toFixed(1)}%</div>
                     </div>
                </div>
            </div>

            <div class="mt-3 pt-2 border-t border-gray-100">
                <div class="flex justify-between items-center">
                    <span class="text-xs text-gray-500 uppercase">Share (vs Tot Arlanda)</span>
                    <span class="text-gray-900 font-bold text-sm">${shareCy.toFixed(2)}%</span>
                </div>
                 <div class="text-right text-xs ${diffPy >= 0 ? 'text-green-600' : 'text-red-600'}">
                    ${diffPy > 0 ? '+' : ''}${diffPy.toFixed(2)} vs PY
                 </div>
            </div>
        `;

        grid.appendChild(card);
    });
}

// ==========================================
// 5. INTERACTIONS
// ==========================================
function drill(name) {
    if (name === 'Direct') return; // Should not happen given logic, but safety

    // Check if node has children
    const newPath = [...state.path, name];
    const children = getNodeChildren(newPath);

    // Only drill if we have children to show
    if (children.length > 0) {
        state.path.push(name);
        updateDashboard();
    } else {
        console.log("No further drill down for " + name);
    }
}

function resetView() {
    state.path = [];
    updateDashboard();
}

function setMetric(m) {
    state.metric = m; // Not used as much now charts are gone, but good for future
}

// Auto Init on Load
initData();
updateDashboard();
