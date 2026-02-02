// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const days = ['Oct 13', 'Oct 14', 'Oct 15', 'Oct 16', 'Oct 17', 'Oct 18', 'Oct 19'];

let state = {
    metric: 'Revenue',
    path: []
};

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
                                cy: { Revenue: rev, PAX: pax, Orders: qty },
                                py: { Revenue: rev / growth, PAX: pax / growth, Orders: qty / growth }
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
        cy: { Revenue: 0, PAX: 0, Orders: 0 },
        py: { Revenue: 0, PAX: 0, Orders: 0 },
        bud: { Revenue: 0, PAX: 0, Orders: 0 },
        tgt: { Revenue: 0, PAX: 0, Orders: 0 }
    };

    let groups = {};
    mainNodes.forEach(name => {
        groups[name] = {
            cy: { Revenue: 0, PAX: 0, Orders: 0, ReturnOrders: 0 },
            py: { Revenue: 0, PAX: 0, Orders: 0 },
            bud: { Revenue: 0, PAX: 0, Orders: 0 },
            tgt: { Revenue: 0, PAX: 0, Orders: 0 }
        };
    });

    let specialGroups = {};
    specialNodes.forEach(name => {
        specialGroups[name] = {
            cy: { Revenue: 0, PAX: 0, Orders: 0, ReturnOrders: 0 },
            py: { Revenue: 0, PAX: 0, Orders: 0 },
            bud: { Revenue: 0, PAX: 0, Orders: 0 },
            tgt: { Revenue: 0, PAX: 0, Orders: 0 }
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
        kpi.cy.Revenue += d.cy.Revenue; kpi.cy.PAX += d.cy.PAX; kpi.cy.Orders += d.cy.Orders;
        kpi.py.Revenue += d.py.Revenue; kpi.py.PAX += d.py.PAX; kpi.py.Orders += d.py.Orders;

        const bucket = classifyRow(d, state.path);
        if (bucket) {
            let targetGroup = groups[bucket] || specialGroups[bucket];
            if (targetGroup) {
                targetGroup.cy.Revenue += d.cy.Revenue;
                targetGroup.cy.PAX += d.cy.PAX;
                targetGroup.cy.Orders += d.cy.Orders;
                if (d.isReturn) targetGroup.cy.ReturnOrders += d.cy.Orders;
                targetGroup.py.Revenue += d.py.Revenue;
                targetGroup.py.PAX += d.py.PAX;
                targetGroup.py.Orders += d.py.Orders;
            }
        }
    });

    // Calculate Budgets/Targets for all groups and global
    const calcBudTgt = (obj) => {
        obj.bud.Revenue = obj.py.Revenue * (1 + REVENUE_BUDGET_GROWTH);
        obj.bud.PAX = obj.py.PAX * (1 + (REVENUE_BUDGET_GROWTH - 0.02)); // PAX grows slightly less than revenue
        obj.bud.Orders = obj.py.Orders * (1 + (REVENUE_BUDGET_GROWTH - 0.03));

        obj.tgt.Revenue = obj.py.Revenue * (1 + REVENUE_TARGET_GROWTH);
        obj.tgt.PAX = obj.py.PAX * (1 + (REVENUE_TARGET_GROWTH - 0.02));
        obj.tgt.Orders = obj.py.Orders * (1 + (REVENUE_TARGET_GROWTH - 0.03));
    };

    calcBudTgt(kpi);
    Object.values(groups).forEach(calcBudTgt);
    Object.values(specialGroups).forEach(calcBudTgt);

    // Global PAX for totals
    let globalTotals = { Revenue: 0, PAX: 0 };
    rawData.forEach(d => {
        globalTotals.Revenue += d.cy.Revenue;
        globalTotals.PAX += d.cy.PAX;
    });

    return { kpi, groups, specialGroups, globalTotals };
}

// ==========================================
// 4. RENDERING
// ==========================================
function updateDashboard() {
    state.groupFilter = 'All';
    const data = getAggregates();

    // Context still uses global PAX vs Airport
    let globalPaxOnly = { cy: 0, py: 0 };
    rawData.forEach(d => { globalPaxOnly.cy += d.cy.PAX; globalPaxOnly.py += d.py.PAX; });
    renderContext(data.kpi, globalPaxOnly);

    renderKPIs(data.kpi);

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

    document.getElementById('kpi-orders').innerText = fmt(kpi.cy.Orders);
    renderComp(kpi.cy.Orders, kpi.py.Orders, kpi.bud.Orders, kpi.tgt.Orders, 'orders');

    document.getElementById('kpi-pax').innerText = fmt(kpi.cy.PAX);
    renderComp(kpi.cy.PAX, kpi.py.PAX, kpi.bud.PAX, kpi.tgt.PAX, 'pax');

    const cyY = kpi.cy.PAX ? kpi.cy.Revenue / kpi.cy.PAX : 0;
    const pyY = kpi.py.PAX ? kpi.py.Revenue / kpi.py.PAX : 0;
    const budY = kpi.bud.PAX ? kpi.bud.Revenue / kpi.bud.PAX : 0;
    const tgtY = kpi.tgt.PAX ? kpi.tgt.Revenue / kpi.tgt.PAX : 0;
    document.getElementById('kpi-yield').innerText = cyY.toFixed(1);
    renderComp(cyY, pyY, budY, tgtY, 'yield');

    const cyA = kpi.cy.Orders ? kpi.cy.Revenue / kpi.cy.Orders : 0;
    const pyA = kpi.py.Orders ? kpi.py.Revenue / kpi.py.Orders : 0;
    const budA = kpi.bud.Orders ? kpi.bud.Revenue / kpi.bud.Orders : 0;
    const tgtA = kpi.tgt.Orders ? kpi.tgt.Revenue / kpi.tgt.Orders : 0;
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

        const paxGrowth = group.py.PAX > 0 ? ((group.cy.PAX - group.py.PAX) / group.py.PAX) * 100 : 0;
        const paxBud = group.bud.PAX > 0 ? ((group.cy.PAX - group.bud.PAX) / group.bud.PAX) * 100 : 0;
        const paxTgt = group.tgt.PAX > 0 ? ((group.cy.PAX - group.tgt.PAX) / group.tgt.PAX) * 100 : 0;

        const yieldVal = group.cy.PAX > 0 ? group.cy.Revenue / group.cy.PAX : 0;
        const yieldPy = group.py.PAX > 0 ? group.py.Revenue / group.py.PAX : 0;
        const yieldBud = group.bud.PAX > 0 ? group.bud.Revenue / group.bud.PAX : 0;
        const yieldTgt = group.tgt.PAX > 0 ? group.tgt.Revenue / group.tgt.PAX : 0;
        const yGrowth = yieldPy > 0 ? ((yieldVal - yieldPy) / yieldPy) * 100 : 0;
        const yBud = yieldBud > 0 ? ((yieldVal - yieldBud) / yieldBud) * 100 : 0;

        const aovVal = group.cy.Orders > 0 ? group.cy.Revenue / group.cy.Orders : 0;
        const aovPy = group.py.Orders > 0 ? group.py.Revenue / group.py.Orders : 0;
        const aovBud = group.bud.Orders > 0 ? group.bud.Revenue / group.bud.Orders : 0;
        const aGrowth = aovPy > 0 ? ((aovVal - aovPy) / aovPy) * 100 : 0;
        const aBud = aovBud > 0 ? ((aovVal - aovBud) / aovBud) * 100 : 0;

        const salesShare = (group.cy.Revenue / globalTotals.Revenue) * 100;
        const returnShare = group.cy.Orders > 0 ? (group.cy.ReturnOrders / group.cy.Orders) * 100 : 0;

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
                         <p class="text-[10px] text-gray-500 uppercase font-bold">PAX</p>
                         <div class="text-xs font-bold ${col(paxGrowth)}">${paxGrowth >= 0 ? '+' : ''}${paxGrowth.toFixed(1)}% vs PY</div>
                    </div>
                    <div class="text-gray-900 font-bold text-lg leading-none mb-1">${fmt(group.cy.PAX)}</div>
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

initData();
updateDashboard();
