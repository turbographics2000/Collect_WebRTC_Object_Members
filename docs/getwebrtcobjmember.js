window.browserHeaders = {};
window.browserCounters = {};
window.tds = {};
window.arrows = {};

var browser = detectBrowser(navigator.userAgent);
var browserMajorVersion = parseInt(browser.version);

var apiData = null;
var implementData = null;
var MediaDeviceInfoData = null;
var pages = [
    {
        url: 'https://www.w3.org/TR/webrtc/',
        legacyElementId: 'legacy-interface-extensions'
    },
    {
        url: 'https://www.w3.org/TR/mediacapture-streams/',
        legacyElementId: 'navigatorusermedia-interface-extensions'
    }
];

if (!browser.name.includes('IE')) {
    if (browser.name === 'Safari' && window.RTCPeerConnection && window.RTCPeerConnection.prototype.addStream) {
        browser.name = 'Safari_LegacyON';
    }

    var fbRef = firebase.database().ref('/');
    fbRef.once('value').then(snap => {
        var snapData = snap.val();
        implementData = snapData.data || {};
        implementData[browser.name] = implementData[browser.name] || {};
        implementData[browser.name][browserMajorVersion] = implementData[browser.name][browserMajorVersion] || {};

        if (browser.name !== 'Edge') {
            var docs = [];
            var parser = new DOMParser();
            var promise = Promise.resolve();
            pages.forEach(page => {
                promise = promise
                    .then(_ => fetch(page.url))
                    .then(res => res.text())
                    .then(txt => {
                        var doc = parser.parseFromString(txt, 'text/html');
                        var legacySection = doc.getElementById(page.legacyElementId);
                        if (legacySection) legacySection.parentElement.removeChild(legacySection);
                        docs.push(doc);
                        return docs;
                    });
            });
            return promise.then(docs => {
                var parseData = WebIDLParse(docs);
                if (JSON.stringify(apiData) !== JSON.stringify(parseData)) {
                    firebase.database().ref('/apiData').set(parseData);
                }
                apiData = parseData;
            });
        } else {
            return new Promise((resolve, reject) => {
                if (snapData.apiData) {
                    apiData = snapData.apiData;
                    resolve();
                } else {
                    reject('No Api Data');
                }
            });
        }
    }).then(_ => {
        return navigator.mediaDevices.enumerateDevices().then(devices => {
            MediaDeviceInfoData = devices;
        });
    }).then(_ => {
        collectImplementData();
        buildTable();
    }).catch(err => {
        console.log(err);
    });
}

function heatColor(alpha) {
    var rA = 0x44;
    var gA = 0xab;
    var bA = 0x44;
    var rB = 0xee;
    var gB = 0x11;
    var bB = 0x11;
    var r = rA * alpha + rB * (1 - alpha) | 0;
    var g = gA * alpha + gB * (1 - alpha) | 0;
    var b = bA * alpha + bB * (1 - alpha) | 0;
    return ('rgb(' + r + ',' + g + ',' + b + ')');
}


function collectImplementData() {
    var TYPE_SPEC = 'spec';
    var TYPE_NOTSPEC = 'notspec';
    var TYPE_LEGACY = 'legacy';
    var currentImplementData = {};
    var totalCnt = 0;
    var legacyCnt = 0;
    var specCnt = 0;
    var notSpecCnt = 0;

    var collect = function (type, className) {
        if ([
            'ConstrainBooleanParameters',
            'ConstrainDOMStringParameters',
            'ConstrainDoubleRange',
            'ConstrainLongRange',
            'DoubleRange',
            'LongRange'
        ].includes(className)) {
            return;
        }
        if (className.endsWith('Init')) {
            return;
        }
        if (className) {
            currentImplementData[className] = true;
        }
        var classPrototype = window[className] ? window[className].prototype : null;
        if (className === 'NavigatorUserMedia') classPrototype = navigator;
        if (className === 'MediaDevices') classPrototype = navigator.mediaDevices;
        if (window[className] && ![
            'HTMLIFrameElement', 
            'RTCStatsReport'
            ].includes(className)) {
            Object.keys(classPrototype).forEach(memberName => {
                if(['toJSON'].includes(memberName)) return;
                if (!Object.keys(apiData[type][className]).includes(memberName)) {
                    legacyCnt++;
                    if (currentImplementData[className] === true) currentImplementData[className] = {};
                    currentImplementData[className][memberName] = TYPE_LEGACY;
                }
            });
        }
        var pc = null, dc = null;
        if (!window.RTCDataChannel) {
            pc = new RTCPeerConnection(null);
            if (pc.createDataChannel) {
                dc = pc.createDataChannel('dc-check');
            }
        }
        Object.keys(apiData[type][className]).sort().forEach(memberType => {
            if (typeof apiData[type][className][memberType] !== 'object') return;
            Object.keys(apiData[type][className][memberType]).sort().forEach(memberName => {
                if(['cs_param_pattern', 'param_pattern', 'toJSON'].includes(memberName)) return;
                if (currentImplementData[className] === true) currentImplementData[className] = {};
                if (className === 'MediaDeviceInfo' && !window.MediaDeviceInfo) {
                    if (MediaDeviceInfoData && MediaDeviceInfoData.length) {
                        totalCnt++;
                        MediaDeviceInfoData.forEach(device => {
                            if (memberName in device) {
                                if (!currentImplementData[className][memberName]) {
                                    specCnt++;
                                    currentImplementData[className][memberName] = TYPE_SPEC;
                                }
                            } else {
                                notSpecCnt++;
                                if (!currentImplementData[className][memberName]) {
                                    notSpecCnt++;
                                    currentImplementData[className][memberName] = TYPE_NOTSPEC;
                                }
                            }
                        });
                        return;
                    }
                } else if (className === 'RTCDataChannel' && !window.RTCDataChannel) {
                    totalCnt++;
                    if (dc && memberName in dc) {
                        specCnt++;
                        currentImplementData[className][memberName] = TYPE_SPEC;
                    } else {
                        notSpecCnt++;
                        currentImplementData[className][memberName] = TYPE_NOTSPEC;
                    }
                    return;
                }
                if (classPrototype && (memberName in classPrototype || classPrototype[memberName])) {
                    specCnt++;
                    currentImplementData[className][memberName] = TYPE_SPEC;
                } else {
                    notSpecCnt++;
                    currentImplementData[className][memberName] = TYPE_NOTSPEC;
                }
                totalCnt++;
            });
        });
    }
    Object.keys(apiData.Interface).sort().forEach(className => collect('Interface', className));
    Object.keys(apiData.Dictionary).sort().forEach(className => collect('Dictionary', className));
    MediaDeviceInfoData = null;
    try {
        if (dc) {
            dc.close();
            dc = null;
        }
        if (pc) {
            pc.close();
            pc = null;
        }
    } catch (ex) { }
    var saveDataTotalCnt = 0;
    var saveDataLegacyCnt = 0;
    var saveDataSpecCnt = 0;
    var saveDataNotSpecCnt = 0;
    Object.keys(implementData[browser.name][browserMajorVersion]).forEach(className => {
        Object.keys(implementData[browser.name][browserMajorVersion][className]).forEach(memberName => {
            switch (implementData[browser.name][browserMajorVersion][className][memberName]) {
                case TYPE_LEGACY:
                    saveDataLegacyCnt++;
                    break;
                case TYPE_SPEC:
                    saveDataSpecCnt++;
                    saveDataTotalCnt++;
                    break;
                case TYPE_NOTSPEC:
                    saveDataNotSpecCnt++;
                    saveDataTotalCnt++;
                    break;
            }
        });
    });
    console.log('total:' + totalCnt, 'specCnt:' + specCnt, 'notSpecCnt:' + notSpecCnt, 'legacyCnt:' + legacyCnt);
    console.log('saveData total:' + saveDataTotalCnt, 'saveData specCnt:' + saveDataSpecCnt, 'saveData notSpecCnt:' + saveDataNotSpecCnt, 'saveData legacyCnt:' + saveDataLegacyCnt);
    if (totalCnt !== saveDataTotalCnt || specCnt !== saveDataSpecCnt) {
        //JSON.stringify(implementData[browser.name][browserMajorVersion]) !== JSON.stringify(currentImplementData)) {
        implementData[browser.name][browserMajorVersion] = currentImplementData;
        firebase.database().ref(`/data/${browser.name}/${browserMajorVersion}`).set(currentImplementData);
    }
}


function buildTable() {
    var headerDiv = document.createElement('div');
    headerDiv.classList.add('col-header');
    var headerTable = document.createElement('table');
    var headerTR = document.createElement('tr');
    headerTR.classList.add('header-row');
    var headerSpacerTD = document.createElement('td');
    headerSpacerTD.id = 'headerSpacer';
    headerTR.appendChild(headerSpacerTD);
    headerTable.appendChild(headerTR);
    headerDiv.appendChild(headerTable);

    var table = document.createElement('table');

    var colSpan = 0;
    Object.keys(implementData).forEach(browserName => {
        colSpan += Object.keys(implementData[browserName]).length;
    });

    var rows = {};
    Object.keys(implementData).sort().forEach(browserName => {
        window.browserHeaders[browserName] = {};
        Object.keys(implementData[browserName]).sort((a, b) => (+b) - (+a)).splice(0, 3).forEach(version => {
            var browserHeaderTD = document.createElement('td');
            browserHeaderTD.classList.add(browserName);
            browserHeaderTD.classList.add('browser-header');
            var browserNameDiv = document.createElement('div');
            browserNameDiv.className = 'browser-name';
            browserNameDiv.textContent = browserName.replace('_', ' ');
            var browserVersionDiv = document.createElement('div');
            browserVersionDiv.className = 'browser-version';
            browserVersionDiv.textContent = version;
            browserHeaderTD.appendChild(browserNameDiv);
            browserHeaderTD.appendChild(browserVersionDiv);
            headerTR.appendChild(browserHeaderTD);
            window.browserHeaders[browserName][version] = browserHeaderTD;

            implementData[browserName][version] = implementData[browserName][version];
            Object.keys(implementData[browserName][version]).sort().forEach(className => {
                rows[className] = rows[className] || {};
                Object.keys(implementData[browserName][version][className]).sort().forEach(memberName => {
                    rows[className][memberName] = implementData[browserName][version][className][memberName];
                });
            });
        });
    });

    Object.keys(rows).sort().forEach(className => {
        var memberNames = Object.keys(rows[className]).sort();
        var classNameTR = document.createElement('tr');
        var classNameTD = document.createElement('td');
        classNameTD.textContent = className;
        classNameTD.classList.add('class-name');
        classNameTD.classList.add('row-header');
        var arrow = document.createElement('div');
        window.arrows[className] = arrow;
        arrow.classList.add('arrow');
        arrow.classList.add(className + 'arrow');
        classNameTD.appendChild(arrow);
        classNameTR.style.cursor = 'pointer';
        classNameTR.appendChild(classNameTD);
        Object.keys(implementData).sort().forEach(browserName => {
            window.browserCounters[browserName] = window.browserCounters[browserName] || {};
            Object.keys(implementData[browserName]).sort((a, b) => (+b) - (+a)).forEach(version => {
                var classImpCntTD = document.createElement('td');
                classImpCntTD.classList.add('imp-cnt');
                var specCnt = Object.keys(implementData[browserName][version][className] || {}).filter(x => implementData[browserName][version][className][x] === 'spec').length;
                var legacyCnt = Object.keys(implementData[browserName][version][className] || {}).filter(x => implementData[browserName][version][className][x] === 'legacy').length;
                var memberCnt = Object.keys(rows[className]).filter(memberName => rows[className][memberName] !== 'legacy').length;
                if (memberCnt) {
                    classImpCntTD.style.background = heatColor(specCnt / memberCnt);
                    classImpCntTD.textContent = specCnt + ' / ' + memberCnt;
                    window.browserCounters[browserName][version] = window.browserCounters[browserName][version] || { specCnt: 0, memberCnt: 0 };
                    window.browserCounters[browserName][version].specCnt += specCnt;
                    window.browserCounters[browserName][version].memberCnt += memberCnt;
                }
                if(legacyCnt) {
                    var legacyCntDiv = document.createElement('div');
                    legacyCntDiv.classList.add('legacy-cnt');
                    legacyCntDiv.textContent = legacyCnt;
                    classImpCntTD.appendChild(legacyCntDiv);
                }
                classNameTR.appendChild(classImpCntTD);
            });
        });
        classNameTR.onclick = function () {
            var cn = this.firstChild.textContent;
            Array.from(document.getElementsByClassName(this.firstChild.textContent + 'member')).forEach(elm => elm.classList.toggle('collapse'));
            document.getElementsByClassName(this.firstChild.textContent + 'arrow')[0].classList.toggle('down');
        }
        table.appendChild(classNameTR);
        memberNames.forEach(memberName => {
            var memberTR = document.createElement('tr');
            memberTR.classList.add(className + 'member');
            memberTR.classList.add('collapse');
            var memberNameTD = document.createElement('td');
            memberTR.classList.add('member-row');
            memberTR.classList.add(rows[className][memberName]);
            memberNameTD.classList.add('member-name');
            memberNameTD.classList.add('row-header');
            memberNameTD.textContent = memberName;
            memberTR.appendChild(memberNameTD);
            Object.keys(implementData).sort().forEach(browserName => {
                Object.keys(implementData[browserName]).sort().reverse().forEach(version => {
                    var memberTD = document.createElement('td');
                    memberTD.classList.add('member-data');
                    memberTD.id = browserName + version + className + memberName;
                    memberTD.classList.add('member-null');
                    var checkDiv = document.createElement('div');
                    memberTD.appendChild(checkDiv);
                    window.tds[browserName + version + className + memberName] = memberTD;
                    memberTR.appendChild(memberTD);
                });
            });
            table.appendChild(memberTR);
        });
    });

    Object.keys(implementData).sort().forEach(browserName => {
        Object.keys(implementData[browserName]).sort().forEach(version => {
            Object.keys(implementData[browserName][version]).sort().forEach(className => {
                if (implementData[browserName][version][className] === null) return;
                members = Object.keys(implementData[browserName][version][className]).sort();
                if (members.length === 0 && window.arrows[className]) {
                    if (window.arrows[className].parentElement) {
                        window.arrows[className].parentElement.removeChild(window.arrows[className]);
                    }
                }
                members.forEach(memberName => {
                    var memberTD = window.tds[browserName + version + className + memberName];

                    memberTD.classList.add('member-data');
                    memberTD.classList.add(implementData[browserName][version][className][memberName]);
                });
            });
        });
    });

    Object.keys(window.browserCounters).forEach(browserName => {
        Object.keys(window.browserCounters[browserName]).forEach(version => {
            var specCnt = window.browserCounters[browserName][version].specCnt;
            var memberCnt = window.browserCounters[browserName][version].memberCnt;
            var header = window.browserHeaders[browserName][version];
            var headerBar = document.createElement('div');
            headerBar.classList.add('header-bar');
            headerBar.style.height = (specCnt / memberCnt * 100) + '%';
            headerBar.style.backgroundColor = heatColor(specCnt / memberCnt);
            header.appendChild(headerBar);
            var headerCnt = document.createElement('div');
            headerCnt.classList.add('header-cnt');
            headerCnt.textContent = specCnt + ' / ' + memberCnt;;
            header.appendChild(headerCnt);
        });
    });

    delete window.tds;
    delete window.arrows;
    delete window.browserHeaders;
    delete window.browserCounters;

    contentBody.appendChild(headerDiv);
    contentBody.appendChild(table);
    var browserCnt = 0;
    var rowHeaderWidth = document.getElementsByClassName('class-name')[0].getBoundingClientRect().width;
    headerSpacerTD.style.width = (rowHeaderWidth - 2) + 'px';
    Object.keys(implementData).forEach(browserName => browserCnt += Object.keys(implementData[browserName]).length);
    headerTable.style.width = table.style.width = (rowHeaderWidth + browserCnt * 100) + 'px';
}
