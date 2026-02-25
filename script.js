// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const days = ['Oct 13', 'Oct 14', 'Oct 15', 'Oct 16', 'Oct 17', 'Oct 18', 'Oct 19'];

let state = {
    metric: 'Revenue',
    path: [],
    activeTab: 'main',
    trendMetric: 'Revenue',
    trendCompare: 'PY'
};

let trendChart = null;
let salesMixChart = null;

let rawData = [];

// ==========================================
// 2. MOCK DATA ENGINE
// ==========================================
function initData() {
    rawData = [];
    const { products: PRODUCTS, hierarchy } = DASHBOARD_DATA;

    days.forEach((day, dIndex) => {
        Object.keys(hierarchy).forEach(group => {
            Object.keys(hierarchy[group]).forEach(channel => {
                const channelData = hierarchy[group][channel];

                const processSub = (sub, leafVal) => {
                    const leaf = leafVal || sub;
                    let profile = getMixProfile(channel);
                    let baseOrders = Math.floor(Math.random() * 50) + 10;

                    if (channel === 'TVM') baseOrders *= 35;
                    else if (channel === 'WEB') baseOrders *= 25;
                    else if (channel === 'APP') baseOrders *= 20;
                    else if (channel === 'ARN T5') baseOrders *= 5;
                    else if (channel === 'Staff tickets') baseOrders *= 3;
                    else if (channel === 'Arlanda employees') baseOrders *= 2;
                    else if (channel === 'Airlines') baseOrders *= 4;
                    else if (channel === 'B2B') baseOrders *= 8;
                    else if (channel === 'Flygtaxi') baseOrders *= 3;
                    else if (channel === 'Samtrafiken') baseOrders *= 3;

                    if (sub === 'Arlanda') baseOrders *= 0.7;
                    if (sub === 'Central station') baseOrders *= 0.3;
                    if (sub === 'SAS') baseOrders *= 1.5;
                    if (sub === 'Norwegian') baseOrders *= 0.5;

                    if (dIndex > 4 && (channel === 'B2B' || channel === 'Staff tickets')) baseOrders *= 0.1;

                    Object.keys(PRODUCTS).forEach(cat => {
                        PRODUCTS[cat].forEach(prod => {
                            const prob = profile[prod.name] || 0.01;
                            const qty = Math.floor(baseOrders * prob * (Math.random() * 0.4 + 0.8));
                            const rev = qty * prod.price;
                            const pax = qty * prod.paxCount;
                            const growth = 1.15 + (Math.random() * 0.1 - 0.05);

                            rawData.push({
                                dIndex, day, group, channel, sub, leaf,
                                productName: prod.name,
                                productCat: prod.cat,
                                isReturn: prod.isReturn || false,
                                cy: { Revenue: rev, Coupons: pax, Transactions: qty },
                                py: { Revenue: rev / growth, Coupons: pax / growth, Transactions: qty / growth }
                            });
                        });
                    });
                };

                if (Array.isArray(channelData)) {
                    channelData.forEach(sub => processSub(sub, null));
                } else {
                    Object.keys(channelData).forEach(sub => {
                        channelData[sub].forEach(leaf => processSub(sub, leaf));
                    });
                }
            });
        });
    });
}

function getMixProfile(channel) {
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
function getNodeChildren(path) {
    const HIERARCHY = DASHBOARD_DATA.hierarchy;
    const MAIN_TOP = ['WEB', 'APP', 'TVM', 'ARN T5', 'Partner'];
    const SPECIAL_TOP = ['Staff tickets', 'Arlanda employees'];

    if (path.length === 0) return { main: MAIN_TOP, special: SPECIAL_TOP };

    const level0 = path[0];
    if (path.length === 1) {
        if (level0 === 'Partner') return Object.keys(HIERARCHY.Partner);
        if (level0 === 'WEB') return [];
        if (HIERARCHY.Direct && HIERARCHY.Direct[level0]) return HIERARCHY.Direct[level0];
        if (HIERARCHY.Special && HIERARCHY.Special[level0]) return HIERARCHY.Special[level0];
    }
    if (path.length === 2 && level0 === 'Partner') {
        const node = HIERARCHY.Partner[path[1]];
        if (Array.isArray(node)) return node;
        if (typeof node === 'object') return Object.keys(node);
    }
    if (path.length === 3 && level0 === 'Partner') {
        const node = HIERARCHY.Partner[path[1]][path[2]];
        if (Array.isArray(node)) return node;
    }
    return [];
}

function classifyRow(d, path) {
    if (path.length === 0) {
        if (['WEB', 'APP', 'TVM', 'ARN T5'].includes(d.channel)) return d.channel;
        if (['Staff tickets', 'Arlanda employees'].includes(d.channel)) return d.channel;
        return 'Partner';
    }
    const level0 = path[0];
    if (level0 === 'Partner') {
        if (path.length === 1) return d.channel;
        if (path.length === 2) return d.sub;
        if (path.length === 3) return d.leaf;
    }
    if (['WEB', 'APP', 'TVM', 'ARN T5', 'Staff tickets', 'Arlanda employees'].includes(level0)) {
        if (path.length === 1) return d.sub;
    }
    return null;
}

function getAggregates() {
    const children = getNodeChildren(state.path);
    const mainNodes = state.path.length === 0 ? children.main : children;
    const specialNodes = state.path.length === 0 ? children.special : [];

    const REVENUE_TARGET_GROWTH = (DASHBOARD_DATA.config.REVENUE_TARGET_GROWTH || 18) / 100;
    const REVENUE_BUDGET_GROWTH = (DASHBOARD_DATA.config.REVENUE_BUDGET_GROWTH || 16.5) / 100;

    let kpi = {
        cy: { Revenue: 0, Coupons: 0, Transactions: 0 },
        py: { Revenue: 0, Coupons: 0, Transactions: 0 },
        bud: { Revenue: 0, Coupons: 0, Transactions: 0 },
        tgt: { Revenue: 0, Coupons: 0, Transactions: 0 }
    };

    let groups = {};
    mainNodes.forEach(name => {
        groups[name] = {
            cy: { Revenue: 0, Coupons: 0, Transactions: 0, ReturnOrders: 0 },
            py: { Revenue: 0, Coupons: 0, Transactions: 0 },
            bud: { Revenue: 0, Coupons: 0, Transactions: 0 },
            tgt: { Revenue: 0, Coupons: 0, Transactions: 0 }
        };
    });

    let specialGroups = {};
    specialNodes.forEach(name => {
        specialGroups[name] = {
            cy: { Revenue: 0, Coupons: 0, Transactions: 0, ReturnOrders: 0 },
            py: { Revenue: 0, Coupons: 0, Transactions: 0 },
            bud: { Revenue: 0, Coupons: 0, Transactions: 0 },
            tgt: { Revenue: 0, Coupons: 0, Transactions: 0 }
        };
    });

    rawData.forEach(d => {
        let inView = true;
        if (state.path.length > 0) {
            const root = state.path[0];
            if (root === 'Partner') {
                if (['WEB', 'APP', 'TVM', 'ARN T5', 'Staff tickets', 'Arlanda employees'].includes(d.channel)) inView = false;
                else {
                    if (state.path.length > 1 && d.channel !== state.path[1]) inView = false;
                    if (state.path.length > 2 && d.sub !== state.path[2]) inView = false;
                }
            } else {
                if (d.channel !== root) inView = false;
            }
        }

        if (!inView) return;

        // Add to CY/PY
        kpi.cy.Revenue += d.cy.Revenue; kpi.cy.Coupons += d.cy.Coupons; kpi.cy.Transactions += d.cy.Transactions;
        kpi.py.Revenue += d.py.Revenue; kpi.py.Coupons += d.py.Coupons; kpi.py.Transactions += d.py.Transactions;

        const bucket = classifyRow(d, state.path);
        if (bucket) {
            let targetGroup = groups[bucket] || specialGroups[bucket];
            if (targetGroup) {
                targetGroup.cy.Revenue += d.cy.Revenue;
                targetGroup.cy.Coupons += d.cy.Coupons;
                targetGroup.cy.Transactions += d.cy.Transactions;
                if (d.isReturn) targetGroup.cy.ReturnOrders += d.cy.Transactions;
                targetGroup.py.Revenue += d.py.Revenue;
                targetGroup.py.Coupons += d.py.Coupons;
                targetGroup.py.Transactions += d.py.Transactions;
            }
        }
    });

    // Calculate Budgets/Targets for all groups and global
    const calcBudTgt = (obj) => {
        obj.bud.Revenue = obj.py.Revenue * (1 + REVENUE_BUDGET_GROWTH);
        obj.bud.Coupons = obj.py.Coupons * (1 + (REVENUE_BUDGET_GROWTH - 0.02)); // Coupons grows slightly less than revenue
        obj.bud.Transactions = obj.py.Transactions * (1 + (REVENUE_BUDGET_GROWTH - 0.03));

        obj.tgt.Revenue = obj.py.Revenue * (1 + REVENUE_TARGET_GROWTH);
        obj.tgt.Coupons = obj.py.Coupons * (1 + (REVENUE_TARGET_GROWTH - 0.02));
        obj.tgt.Transactions = obj.py.Transactions * (1 + (REVENUE_TARGET_GROWTH - 0.03));
    };

    calcBudTgt(kpi);
    Object.values(groups).forEach(calcBudTgt);
    Object.values(specialGroups).forEach(calcBudTgt);

    // Global Coupons for totals
    let globalTotals = { Revenue: 0, Coupons: 0 };
    rawData.forEach(d => {
        globalTotals.Revenue += d.cy.Revenue;
        globalTotals.Coupons += d.cy.Coupons;
    });

    return { kpi, groups, specialGroups, globalTotals };
}

// ==========================================
// 4. RENDERING
// ==========================================
function updateDashboard() {
    state.groupFilter = 'All';
    const data = getAggregates();

    // Context still uses global Coupons vs Airport
    let globalPaxOnly = { cy: 0, py: 0 };
    rawData.forEach(d => { globalPaxOnly.cy += d.cy.Coupons; globalPaxOnly.py += d.py.Coupons; });
    renderContext(data.kpi, globalPaxOnly);

    renderKPIs(data.kpi);
    renderSalesMixChart();

    document.getElementById('xcom-grid').innerHTML = '';
    document.getElementById('special-grid').innerHTML = '';

    renderCards(data.groups, data.globalTotals, 'xcom-grid');

    const specialSec = document.getElementById('special-section');
    if (state.path.length === 0) {
        specialSec.classList.remove('hidden');
        renderCards(data.specialGroups, data.globalTotals, 'special-grid');
    } else {
        specialSec.classList.add('hidden');
    }
}

function renderContext(kpi, globalPax) {
    const cfg = DASHBOARD_DATA.config;
    const AIRPORT_GROWTH_PCT = cfg.AIRPORT_GROWTH_PCT;
    const AIRPORT_BUDGET_GROWTH = cfg.AIRPORT_BUDGET_GROWTH;
    const AIRPORT_TARGET_GROWTH = cfg.AIRPORT_TARGET_GROWTH;

    const airportPy = globalPax.py * 5;
    const airportCy = airportPy * (1 + (AIRPORT_GROWTH_PCT / 100));

    // Airport Performance Card
    document.getElementById('ctx-airport-actual').innerText = `${AIRPORT_GROWTH_PCT > 0 ? '+' : ''}${AIRPORT_GROWTH_PCT.toFixed(1)}%`;

    const airBudVar = AIRPORT_GROWTH_PCT - AIRPORT_BUDGET_GROWTH;
    const airTgtVar = AIRPORT_GROWTH_PCT - AIRPORT_TARGET_GROWTH;
    const col = (v) => v >= 0 ? 'text-green-600' : 'text-red-600';

    document.getElementById('ctx-airport-bud').innerHTML = `Bud: <span class="${col(airBudVar)}">${airBudVar > 0 ? '+' : ''}${airBudVar.toFixed(1)} pp</span>`;
    document.getElementById('ctx-airport-tgt').innerHTML = `Tgt: <span class="${col(airTgtVar)}">${airTgtVar > 0 ? '+' : ''}${airTgtVar.toFixed(1)} pp</span>`;

    // AEX Market Share Card
    const shareCy = (globalPax.cy / airportCy) * 100;
    const sharePy = (globalPax.py / airportPy) * 100;
    const shareDelta = shareCy - sharePy;

    document.getElementById('ctx-share').innerText = shareCy.toFixed(1) + '%';
    document.getElementById('ctx-share-delta').innerHTML = `<span class="${shareDelta >= 0 ? 'text-green-600' : 'text-red-600'}">${shareDelta > 0 ? '+' : ''}${shareDelta.toFixed(2)} pp</span> vs PY`;

    const shareBudVar = shareCy - cfg.MARKET_SHARE_BUDGET;
    const shareTgtVar = shareCy - cfg.MARKET_SHARE_TARGET;

    document.getElementById('ctx-share-bud').innerHTML = `| Bud: <span class="${col(shareBudVar)}">${shareBudVar > 0 ? '+' : ''}${shareBudVar.toFixed(2)} pp</span>`;
    document.getElementById('ctx-share-tgt').innerHTML = `| Tgt: <span class="${col(shareTgtVar)}">${shareTgtVar > 0 ? '+' : ''}${shareTgtVar.toFixed(2)} pp</span>`;
}

function renderKPIs(kpi) {
    const fmt = (n) => new Intl.NumberFormat('sv-SE').format(Math.round(n));

    const renderComp = (cy, py, bud, tgt, idBase) => {
        const pyPct = py > 0 ? ((cy - py) / py) * 100 : 0;
        const budPct = bud > 0 ? ((cy - bud) / bud) * 100 : 0;
        const tgtPct = tgt > 0 ? ((cy - tgt) / tgt) * 100 : 0;

        const elPy = document.getElementById(`var-${idBase}`);
        elPy.innerHTML = `${pyPct >= 0 ? '▲' : '▼'} ${Math.abs(pyPct).toFixed(1)}%`;
        elPy.className = pyPct >= 0 ? 'var-pos' : 'var-neg';

        const elBud = document.getElementById(`var-${idBase}-bud`);
        elBud.innerHTML = `Bud: <span class="${budPct >= 0 ? 'text-green-600' : 'text-red-600'}">${budPct > 0 ? '+' : ''}${budPct.toFixed(1)}%</span>`;

        const elTgt = document.getElementById(`var-${idBase}-tgt`);
        elTgt.innerHTML = `Tgt: <span class="${tgtPct >= 0 ? 'text-green-600' : 'text-red-600'}">${tgtPct > 0 ? '+' : ''}${tgtPct.toFixed(1)}%</span>`;
    };

    document.getElementById('kpi-rev').innerText = fmt(kpi.cy.Revenue);
    renderComp(kpi.cy.Revenue, kpi.py.Revenue, kpi.bud.Revenue, kpi.tgt.Revenue, 'rev');

    document.getElementById('kpi-transactions').innerText = fmt(kpi.cy.Transactions);
    renderComp(kpi.cy.Transactions, kpi.py.Transactions, kpi.bud.Transactions, kpi.tgt.Transactions, 'transactions');

    document.getElementById('kpi-coupons').innerText = fmt(kpi.cy.Coupons);
    renderComp(kpi.cy.Coupons, kpi.py.Coupons, kpi.bud.Coupons, kpi.tgt.Coupons, 'coupons');

    const cyY = kpi.cy.Coupons ? kpi.cy.Revenue / kpi.cy.Coupons : 0;
    const pyY = kpi.py.Coupons ? kpi.py.Revenue / kpi.py.Coupons : 0;
    const budY = kpi.bud.Coupons ? kpi.bud.Revenue / kpi.bud.Coupons : 0;
    const tgtY = kpi.tgt.Coupons ? kpi.tgt.Revenue / kpi.tgt.Coupons : 0;
    document.getElementById('kpi-yield').innerText = cyY.toFixed(1);
    renderComp(cyY, pyY, budY, tgtY, 'yield');

    const cyA = kpi.cy.Transactions ? kpi.cy.Revenue / kpi.cy.Transactions : 0;
    const pyA = kpi.py.Transactions ? kpi.py.Revenue / kpi.py.Transactions : 0;
    const budA = kpi.bud.Transactions ? kpi.bud.Revenue / kpi.bud.Transactions : 0;
    const tgtA = kpi.tgt.Transactions ? kpi.tgt.Revenue / kpi.tgt.Transactions : 0;
    document.getElementById('kpi-aov').innerText = cyA.toFixed(0);
    renderComp(cyA, pyA, budA, tgtA, 'aov');
}

function renderCards(groups, globalTotals, containerId) {
    const grid = document.getElementById(containerId);

    Object.keys(groups).forEach(groupName => {
        const group = groups[groupName];
        if (!group) return;

        let borderColor = 'border-gray-400';
        let icon = 'fa-chart-bar';
        let iconColor = 'text-gray-600';

        if (groupName === 'WEB') { borderColor = 'border-blue-500'; icon = 'fa-globe'; iconColor = 'text-blue-500'; }
        if (groupName === 'APP') { borderColor = 'border-indigo-500'; icon = 'fa-mobile-alt'; iconColor = 'text-indigo-500'; }
        if (groupName === 'TVM') { borderColor = 'border-yellow-400'; icon = 'fa-desktop'; iconColor = 'text-yellow-600'; }
        if (groupName === 'ARN T5') { borderColor = 'border-orange-500'; icon = 'fa-store'; iconColor = 'text-orange-500'; }
        if (groupName === 'Partner') { borderColor = 'border-green-500'; icon = 'fa-handshake'; iconColor = 'text-green-600'; }
        if (groupName === 'Staff tickets') { borderColor = 'border-pink-500'; icon = 'fa-id-badge'; iconColor = 'text-pink-500'; }
        if (groupName === 'Arlanda employees') { borderColor = 'border-teal-500'; icon = 'fa-user-tie'; iconColor = 'text-teal-500'; }

        const revGrowth = group.py.Revenue > 0 ? ((group.cy.Revenue - group.py.Revenue) / group.py.Revenue) * 100 : 0;
        const revBud = group.bud.Revenue > 0 ? ((group.cy.Revenue - group.bud.Revenue) / group.bud.Revenue) * 100 : 0;
        const revTgt = group.tgt.Revenue > 0 ? ((group.cy.Revenue - group.tgt.Revenue) / group.tgt.Revenue) * 100 : 0;

        const paxGrowth = group.py.Coupons > 0 ? ((group.cy.Coupons - group.py.Coupons) / group.py.Coupons) * 100 : 0;
        const paxBud = group.bud.Coupons > 0 ? ((group.cy.Coupons - group.bud.Coupons) / group.bud.Coupons) * 100 : 0;
        const paxTgt = group.tgt.Coupons > 0 ? ((group.cy.Coupons - group.tgt.Coupons) / group.tgt.Coupons) * 100 : 0;

        const yieldVal = group.cy.Coupons > 0 ? group.cy.Revenue / group.cy.Coupons : 0;
        const yieldPy = group.py.Coupons > 0 ? group.py.Revenue / group.py.Coupons : 0;
        const yieldBud = group.bud.Coupons > 0 ? group.bud.Revenue / group.bud.Coupons : 0;
        const yieldTgt = group.tgt.Coupons > 0 ? group.tgt.Revenue / group.tgt.Coupons : 0;
        const yGrowth = yieldPy > 0 ? ((yieldVal - yieldPy) / yieldPy) * 100 : 0;
        const yBud = yieldBud > 0 ? ((yieldVal - yieldBud) / yieldBud) * 100 : 0;

        const aovVal = group.cy.Transactions > 0 ? group.cy.Revenue / group.cy.Transactions : 0;
        const aovPy = group.py.Transactions > 0 ? group.py.Revenue / group.py.Transactions : 0;
        const aovBud = group.bud.Transactions > 0 ? group.bud.Revenue / group.bud.Transactions : 0;
        const aGrowth = aovPy > 0 ? ((aovVal - aovPy) / aovPy) * 100 : 0;
        const aBud = aovBud > 0 ? ((aovVal - aovBud) / aovBud) * 100 : 0;

        const salesShare = (group.cy.Revenue / globalTotals.Revenue) * 100;
        const returnShare = group.cy.Transactions > 0 ? (group.cy.ReturnOrders / group.cy.Transactions) * 100 : 0;

        const fmt = (n) => new Intl.NumberFormat('sv-SE').format(Math.round(n));
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
                </div>
                <i class="fas fa-chevron-right text-gray-300 text-xs mt-1"></i>
            </div>
            <div class="space-y-4">
                <div>
                    <div class="flex justify-between items-baseline mb-1">
                         <p class="text-[10px] text-gray-500 uppercase font-bold">Revenue</p>
                         <div class="text-xs font-bold ${col(revGrowth)}">${revGrowth >= 0 ? '+' : ''}${revGrowth.toFixed(1)}% vs PY</div>
                    </div>
                    <div class="text-gray-900 font-bold text-lg leading-none mb-1">${fmt(group.cy.Revenue)}</div>
                    <div class="text-[10px] text-gray-400 font-medium">
                        Bud: <span class="${col(revBud)}">${revBud > 0 ? '+' : ''}${revBud.toFixed(1)}%</span> | 
                        Tgt: <span class="${col(revTgt)}">${revTgt > 0 ? '+' : ''}${revTgt.toFixed(1)}%</span>
                    </div>
                </div>
                
                <div>
                    <div class="flex justify-between items-baseline mb-1">
                         <p class="text-[10px] text-gray-500 uppercase font-bold">Coupons</p>
                         <div class="text-xs font-bold ${col(paxGrowth)}">${paxGrowth >= 0 ? '+' : ''}${paxGrowth.toFixed(1)}% vs PY</div>
                    </div>
                    <div class="text-gray-900 font-bold text-lg leading-none mb-1">${fmt(group.cy.Coupons)}</div>
                    <div class="text-[10px] text-gray-400 font-medium">
                        Bud: <span class="${col(paxBud)}">${paxBud > 0 ? '+' : ''}${paxBud.toFixed(1)}%</span> | 
                        Tgt: <span class="${col(paxTgt)}">${paxTgt > 0 ? '+' : ''}${paxTgt.toFixed(1)}%</span>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3 pt-1 border-t border-gray-50">
                     <div>
                        <p class="text-[10px] text-gray-500 uppercase font-bold mb-1">Yield</p>
                        <div class="text-gray-900 font-bold text-sm mb-1">${Math.round(yieldVal)}</div>
                        <div class="text-[9px] ${col(yGrowth)}">${yGrowth > 0 ? '+' : ''}${yGrowth.toFixed(1)}% vs PY</div>
                     </div>
                     <div>
                        <p class="text-[10px] text-gray-500 uppercase font-bold mb-1">AOV</p>
                        <div class="text-gray-900 font-bold text-sm mb-1">${Math.round(aovVal)}</div>
                        <div class="text-[9px] ${col(aGrowth)}">${aGrowth > 0 ? '+' : ''}${aGrowth.toFixed(1)}% vs PY</div>
                     </div>
                </div>
            </div>
            <div class="mt-3 pt-2 border-t border-gray-100 flex justify-between items-center text-xs">
                 <div>
                    <span class="text-[10px] text-gray-500 uppercase font-bold">Sales Share:</span>
                    <span class="text-gray-900 font-bold">${salesShare.toFixed(1)}%</span>
                 </div>
                 <div>
                    <span class="text-[10px] text-gray-500 uppercase font-bold">Return Share:</span>
                    <span class="text-blue-600 font-bold">${returnShare.toFixed(1)}%</span>
                 </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function drill(name) {
    const nextPath = [...state.path, name];
    const children = getNodeChildren(nextPath);
    const hasChildren = Array.isArray(children) ? children.length > 0 : (children.main || children.special);
    if (name === 'WEB') return;
    if (hasChildren) {
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
    state.metric = m;
}

function switchTab(tab) {
    state.activeTab = tab;

    const tabs = ['main', 'trends'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        const content = document.getElementById(`tab-${t}-content`);

        if (t === tab) {
            btn.classList.add('bg-white', 'text-black', 'shadow-sm');
            btn.classList.remove('text-gray-500');
            content.classList.remove('hidden');
        } else {
            btn.classList.remove('bg-white', 'text-black', 'shadow-sm');
            btn.classList.add('text-gray-500');
            content.classList.add('hidden');
        }
    });

    if (tab === 'trends') {
        updateTrends();
    }
}

function setTrendMetric(m) {
    state.trendMetric = m;
    const btns = document.querySelectorAll('.trend-metric-btn');
    btns.forEach(b => b.classList.remove('active'));
    const btnId = `btn-m-${m.replace(' ', '')}`;
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('active');
    updateTrends();
}

function updateTrends() {
    const channel = document.getElementById('trend-channel').value;
    const compareMode = document.getElementById('trend-compare').value;
    const metric = state.trendMetric;

    document.getElementById('trend-chart-title').innerText = `${metric} Performance: ${channel}`;
    document.getElementById('comparison-legend-label').innerText = compareMode === 'PY' ? 'Prior Year' :
        compareMode === 'Budget' ? 'Budget' : 'Target';

    // 1. Prepare Data
    const labels = days;
    const cyData = [];
    const compData = [];
    const marketShareData = [];
    const airportPaxData = [];

    labels.forEach((day, dIdx) => {
        let cySum = 0;
        let compSum = 0;
        let totalAexPaxCy = 0;
        let totalAexPaxPy = 0;

        // Calculate selected metric + total PAX for context
        rawData.filter(d => d.dIndex === dIdx).forEach(d => {
            totalAexPaxCy += d.cy.Coupons;
            totalAexPaxPy += d.py.Coupons;

            let match = false;
            if (channel === 'Total') match = true;
            else if (channel === 'Partner') {
                if (!['WEB', 'APP', 'TVM', 'ARN T5', 'Staff tickets', 'Arlanda employees'].includes(d.channel)) match = true;
            } else {
                if (d.channel === channel) match = true;
            }

            if (match) {
                const getVal = (obj, m) => {
                    if (m === 'Revenue') return obj.Revenue;
                    if (m === 'Coupons') return obj.Coupons;
                    if (m === 'Transactions') return obj.Transactions;
                    if (m === 'Yield') return obj.Coupons > 0 ? obj.Revenue / obj.Coupons : 0;
                    return 0;
                };

                if (metric !== 'Return Share') {
                    cySum += getVal(d.cy, metric);

                    if (compareMode === 'PY') {
                        compSum += getVal(d.py, metric);
                    } else if (compareMode === 'Budget') {
                        const growth = (DASHBOARD_DATA.config.REVENUE_BUDGET_GROWTH || 16.5) / 100;
                        const v = getVal(d.py, metric);
                        compSum += v * (1 + growth);
                    } else {
                        const growth = (DASHBOARD_DATA.config.REVENUE_TARGET_GROWTH || 18) / 100;
                        const v = getVal(d.py, metric);
                        compSum += v * (1 + growth);
                    }
                }
            }
        });

        // Special handling for averages/ratios per day
        if (metric === 'Yield') {
            let totalRev = 0; let totalPax = 0;
            let totalRevComp = 0; let totalPaxComp = 0;
            rawData.filter(d => d.dIndex === dIdx).forEach(d => {
                let match = (channel === 'Total' || d.channel === channel || (channel === 'Partner' && !['WEB', 'APP', 'TVM', 'ARN T5', 'Staff tickets', 'Arlanda employees'].includes(d.channel)));
                if (match) {
                    totalRev += d.cy.Revenue; totalPax += d.cy.Coupons;
                    totalRevComp += d.py.Revenue; totalPaxComp += d.py.Coupons;
                }
            });
            cyData.push(totalPax > 0 ? totalRev / totalPax : 0);
            const growth = compareMode === 'Budget' ? (DASHBOARD_DATA.config.REVENUE_BUDGET_GROWTH / 100) : (DASHBOARD_DATA.config.REVENUE_TARGET_GROWTH / 100);
            if (compareMode === 'PY') compData.push(totalPaxComp > 0 ? totalRevComp / totalPaxComp : 0);
            else compData.push((totalPaxComp > 0 ? totalRevComp / totalPaxComp : 0) * (1 + growth));
        } else if (metric === 'Return Share') {
            let totalTransactions = 0; let totalReturn = 0;
            let totalTransactionsComp = 0; let totalReturnComp = 0;
            rawData.filter(d => d.dIndex === dIdx).forEach(d => {
                let match = (channel === 'Total' || d.channel === channel || (channel === 'Partner' && !['WEB', 'APP', 'TVM', 'ARN T5', 'Staff tickets', 'Arlanda employees'].includes(d.channel)));
                if (match) {
                    totalTransactions += d.cy.Transactions;
                    if (d.isReturn) totalReturn += d.cy.Transactions;
                    totalTransactionsComp += d.py.Transactions;
                    if (d.isReturn) totalReturnComp += d.py.Transactions;
                }
            });
            cyData.push(totalTransactions > 0 ? (totalReturn / totalTransactions) * 100 : 0);
            compData.push(totalTransactionsComp > 0 ? (totalReturnComp / totalTransactionsComp) * 100 : 0);
        } else {
            cyData.push(cySum);
            compData.push(compSum);
        }

        // Contextual Metrics (Market Share & Arlanda Pax)
        const airGrowth = DASHBOARD_DATA.config.AIRPORT_GROWTH_PCT / 100;
        const airportPaxPy = totalAexPaxPy * (5 + (Math.random() * 0.4 - 0.2));
        const airportPaxCy = airportPaxPy * (1 + airGrowth + (Math.random() * 0.02 - 0.01));

        airportPaxData.push(airportPaxCy);
        marketShareData.push((totalAexPaxCy / airportPaxCy) * 100);
    });

    renderTrendChart(labels, cyData, compData, metric, marketShareData, airportPaxData);
    renderTrendStats(cyData, compData, metric, compareMode);
    renderTrendMetricGrid(channel, compareMode);
}

function renderTrendChart(labels, cyData, compData, metric, marketShareData, airportPaxData) {
    const ctx = document.getElementById('trendChart').getContext('2d');

    if (trendChart) {
        trendChart.destroy();
    }

    const isPct = metric === 'Return Share';

    trendChart = new Chart(ctx, {
        type: 'line', // Base type
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Airport Total PAX',
                    type: 'bar',
                    data: airportPaxData,
                    backgroundColor: 'rgba(203, 213, 225, 0.2)', // Light gray bars
                    borderColor: 'transparent',
                    yAxisID: 'yAirport',
                    order: 4
                },
                {
                    label: 'Market Share',
                    data: marketShareData,
                    borderColor: '#9333ea', // Purple
                    borderWidth: 2,
                    pointRadius: 3,
                    tension: 0.4,
                    fill: false,
                    yAxisID: 'yShare',
                    order: 3
                },
                {
                    label: 'Current Period',
                    data: cyData,
                    borderColor: '#2563eb', // Blue
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: '#2563eb',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y',
                    order: 1
                },
                {
                    label: 'Comparison',
                    data: compData,
                    borderColor: '#1e293b', // Dark slate
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.4,
                    fill: false,
                    yAxisID: 'y',
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            const val = context.parsed.y;
                            if (context.dataset.yAxisID === 'yShare' || isPct && context.dataset.yAxisID === 'y') {
                                label += val.toFixed(1) + '%';
                            } else {
                                label += new Intl.NumberFormat('sv-SE').format(Math.round(val));
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    position: 'left',
                    beginAtZero: false,
                    title: { display: true, text: metric, font: { size: 10, weight: 'bold' } },
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        callback: (value) => isPct ? value + '%' : new Intl.NumberFormat('sv-SE', { notation: 'compact' }).format(value)
                    }
                },
                yShare: {
                    position: 'right',
                    beginAtZero: true,
                    max: isPct ? 100 : undefined,
                    title: { display: true, text: 'Market Share (%)', font: { size: 10, weight: 'bold' } },
                    grid: { display: false },
                    ticks: {
                        callback: (value) => value + '%'
                    }
                },
                yAirport: {
                    position: 'right',
                    display: false, // Keep it for scaling but hide labels to avoid clutter
                    beginAtZero: true
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderTrendStats(cyData, compData, metric, compareMode) {
    const totalCy = cyData.reduce((a, b) => a + b, 0);
    const totalComp = compData.reduce((a, b) => a + b, 0);

    const isAvg = ['Yield', 'Return Share'].includes(metric);
    const valCy = isAvg ? totalCy / cyData.length : totalCy;
    const valComp = isAvg ? totalComp / compData.length : totalComp;

    const diff = valCy - valComp;
    const pct = valComp > 0 ? (diff / valComp) * 100 : 0;

    const fmt = (n) => isAvg ? n.toFixed(1) + (metric === 'Return Share' ? '%' : '') : new Intl.NumberFormat('sv-SE').format(Math.round(n));

    const card = document.getElementById('trend-stat-card');
    card.innerHTML = `
        <p class="text-[10px] font-bold text-gray-500 uppercase mb-1">Period Average</p>
        <h4 class="text-2xl font-bold text-gray-900 mb-2">${fmt(valCy)}</h4>
        <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${pct >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">
                ${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%
            </span>
            <span class="text-[10px] text-gray-400 font-medium">vs ${compareMode}</span>
        </div>
    `;
}

function renderTrendMetricGrid(channel, compareMode) {
    const grid = document.getElementById('metric-grid-trends');
    grid.innerHTML = '';

    const metrics = ['Revenue', 'Coupons', 'Transactions', 'Yield', 'Return Share'];

    metrics.forEach(m => {
        if (m === state.trendMetric) return;

        let cyArr = []; let compArr = [];

        days.forEach((day, dIdx) => {
            let dayCy = 0; let dayComp = 0;
            let orders = 0; let returns = 0;
            let ordersP = 0; let returnsP = 0;
            let rev = 0; let pax = 0;
            let revP = 0; let paxP = 0;

            rawData.filter(d => d.dIndex === dIdx).forEach(d => {
                let match = (channel === 'Total' || d.channel === channel || (channel === 'Partner' && !['WEB', 'APP', 'TVM', 'ARN T5', 'Staff tickets', 'Arlanda employees'].includes(d.channel)));
                if (match) {
                    if (m === 'Revenue') { dayCy += d.cy.Revenue; dayComp += d.py.Revenue; }
                    if (m === 'Coupons') { dayCy += d.cy.Coupons; dayComp += d.py.Coupons; }
                    if (m === 'Transactions') { dayCy += d.cy.Transactions; dayComp += d.py.Transactions; }
                    if (m === 'Yield') { rev += d.cy.Revenue; pax += d.cy.Coupons; revP += d.py.Revenue; paxP += d.py.Coupons; }
                    if (m === 'Return Share') { orders += d.cy.Transactions; if (d.isReturn) returns += d.cy.Transactions; ordersP += d.py.Transactions; if (d.isReturn) returnsP += d.py.Transactions; }
                }
            });

            if (m === 'Yield') {
                dayCy = pax > 0 ? rev / pax : 0;
                dayComp = paxP > 0 ? revP / paxP : 0;
            } else if (m === 'Return Share') {
                dayCy = orders > 0 ? (returns / orders) * 100 : 0;
                dayComp = ordersP > 0 ? (returnsP / ordersP) * 100 : 0;
            }

            if (m !== 'Yield' && m !== 'Return Share') {
                if (compareMode === 'Budget') dayComp *= 1.165;
                if (compareMode === 'Target') dayComp *= 1.18;
            } else if (m === 'Yield') {
                if (compareMode === 'Budget') dayComp *= 1.165;
                if (compareMode === 'Target') dayComp *= 1.18;
            }

            cyArr.push(dayCy);
            compArr.push(dayComp);
        });

        const vCy = ['Yield', 'Return Share'].includes(m) ? cyArr.reduce((a, b) => a + b, 0) / cyArr.length : cyArr.reduce((a, b) => a + b, 0);
        const vComp = ['Yield', 'Return Share'].includes(m) ? compArr.reduce((a, b) => a + b, 0) / compArr.length : compArr.reduce((a, b) => a + b, 0);
        const p = vComp > 0 ? ((vCy - vComp) / vComp) * 100 : 0;

        const fmt = (n) => ['Yield', 'Return Share'].includes(m) ? n.toFixed(1) + (m === 'Return Share' ? '%' : '') : new Intl.NumberFormat('sv-SE', { notation: 'compact' }).format(Math.round(n));

        const card = document.createElement('div');
        card.className = 'card p-4 cursor-pointer hover:border-blue-300 transition-colors bg-white';
        card.onclick = () => setTrendMetric(m);
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <p class="text-[10px] font-bold text-gray-400 uppercase">${m}</p>
                <span class="text-[10px] font-bold ${p >= 0 ? 'text-green-600' : 'text-red-600'}">${p >= 0 ? '+' : ''}${p.toFixed(1)}%</span>
            </div>
            <p class="text-xl font-bold text-gray-900">${fmt(vCy)}</p>
        `;
        grid.appendChild(card);
    });
}

function renderSalesMixChart() {
    const ctx = document.getElementById('salesMixChart').getContext('2d');
    if (salesMixChart) salesMixChart.destroy();

    const dataByDay = days.map(() => ({}));
    const products = DASHBOARD_DATA.products;
    const categories = Object.keys(products);

    rawData.forEach(d => {
        let inView = true;
        if (state.path.length > 0) {
            const root = state.path[0];
            if (root === 'Partner') {
                if (['WEB', 'APP', 'TVM', 'ARN T5', 'Staff tickets', 'Arlanda employees'].includes(d.channel)) inView = false;
                else {
                    if (state.path.length > 1 && d.channel !== state.path[1]) inView = false;
                    if (state.path.length > 2 && d.sub !== state.path[2]) inView = false;
                }
            } else {
                if (d.channel !== root) inView = false;
            }
        }
        if (!inView) return;

        const cat = d.productCat;
        dataByDay[d.dIndex][cat] = (dataByDay[d.dIndex][cat] || 0) + d.cy.Revenue;
    });

    const colors = {
        'Standard': '#2563eb', // Blue-600
        'Group': '#4f46e5',    // Indigo-600
        'Discount': '#f59e0b', // Amber-500
        'Commuter': '#10b981'  // Emerald-500
    };

    const datasets = categories.map(cat => ({
        label: cat,
        data: dataByDay.map(dayData => dayData[cat] || 0),
        backgroundColor: colors[cat] + '99', // ~60% opacity fill
        borderColor: colors[cat],
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 2
    }));

    salesMixChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 6, font: { size: 10, weight: 'bold' } } },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return `${context.dataset.label}: ${new Intl.NumberFormat('sv-SE').format(Math.round(context.parsed.y))} SEK`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: { display: true, text: 'Revenue (SEK)', font: { size: 10, weight: 'bold' } },
                    grid: { color: '#f1f5f9' },
                    ticks: { callback: (val) => new Intl.NumberFormat('sv-SE', { notation: 'compact' }).format(val) }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

initData();
updateDashboard();

