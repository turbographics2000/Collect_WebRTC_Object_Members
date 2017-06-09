var browser = detectBrowser(navigator.userAgent);
var browserMajorVersion = parseInt(browser.version);

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

function getDocs() {
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
  return promise;
}

function removeParamPattern(obj) {
  if (typeof obj !== 'object') return;
  Object.keys(obj).forEach(key => {
    if (key === 'cs_param_pattern' ||
      key === 'param_pattern' ||
      key === 'HTMLIFrameElement' ||
      Object.keys(obj[key]).length === 0 ||
      (obj[key].Member && ((obj[key].Member.min && obj[key].Member.max) || (obj[key].Member.ideal && obj[key].Member.exact)))) {
      delete obj[key];
    } else {
      removeParamPattern(obj[key]);
    }
  });
}

getDocs().then(docs => {
  var TYPE_SPEC = 'spec';
  var TYPE_NOTSPEC = 'notspec';
  var TYPE_LEGACY = 'legacy';
  var parseData = WebIDLParse(docs);
  removeParamPattern(parseData);
  var specObjMembers = {};
  objMembers = {};
  var legacyCnt = 0;
  var specCnt = 0;
  var notSpecCnt = 0;
  var collect = function (type, className) {
    objMembers[className] = {};
    if (window[className]) {
      var flg = false;
      Object.keys(window[className].prototype).forEach(memberName => {
        if (memberName === 'toJSON') return;
        Object.keys(parseData[type][className]).forEach(memberType => {
          if (typeof parseData[type][className][memberType] !== 'object') return;
          if (Object.keys(parseData[type][className][memberType]).includes(memberName)) {
            flg = true;
          }
        });
        if (!flg) {
          legacyCnt++;
          objMembers[className][memberName] = TYPE_LEGACY;
        }
      });
      Object.keys(parseData[type][className]).forEach(memberType => {
        if (typeof parseData[type][className][memberType] !== 'object') return;
        Object.keys(parseData[type][className][memberType]).forEach(memberName => {
          if (memberName in window[className].prototype) {
            specCnt++;
            objMembers[className][memberName] = TYPE_SPEC;
          } else {
            notSpecCnt++;
            objMembers[className][memberName] = TYPE_NOTSPEC;
          }
        });
      });
    } else {
      objMembers[className] = null;
    }
  }

  Object.keys(parseData.Dictionary).forEach(className => collect('Dictionary', className));
  Object.keys(parseData.Interface).forEach(className => collect('Interface', className));

  buildTable(objMembers);
});

function buildTable(objMembers) {
  var saveData = {};

  var table = document.createElement('table');
  table.id = 'table-wrapper';
  var headerTR = document.createElement('tr');
  var headerSpacerTD = document.createElement('td');
  headerTR.appendChild(headerSpacerTD);
  table.appendChild(headerTR);

  var data = JSON.parse(localStorage.getItem('data') || null) || {};
  data[browser.name] = data[browser.name] || {};
  data[browser.name][browserMajorVersion] = objMembers;

  var colSpan = 0;
  Object.keys(data).forEach(browserName => {
    colSpan += Object.keys(data[browserName]).length;
  });

  var rows = {};
  Object.keys(data).sort().forEach(browserName => {
    saveData[browserName] = data[browserName];
    Object.keys(data[browserName]).sort((a, b) => (+b) - (+a)).splice(0, 3).forEach(version => {
      var browserHeaderTD = document.createElement('td');
      browserHeaderTD.classList.add(browserName);
      browserHeaderTD.classList.add('browser-header');
      var browserNameDiv = document.createElement('div');
      browserNameDiv.className = 'browser-name';
      browserNameDiv.textContent = browserName;
      var browserVersionDiv = document.createElement('div');
      browserVersionDiv.className = 'browser-version';
      browserVersionDiv.textContent = browserMajorVersion;
      browserHeaderTD.appendChild(browserNameDiv);
      browserHeaderTD.appendChild(browserVersionDiv);
      headerTR.appendChild(browserHeaderTD);

      saveData[browserName][version] = data[browserName][version];
      Object.keys(data[browserName][version]).sort().forEach(className => {
        if (data[browserName][version][className] === null) {
          rows[className] = null;
        } else {
          rows[className] = {};
          Object.keys(data[browserName][version][className]).sort().forEach(memberName => {
            rows[className][memberName] = data[browserName][version][className][memberName];
          });
        }
      });
    });
  });

  window.tds = {};
  Object.keys(rows).sort().forEach(className => {
    var memberNames = rows[className] === null ? null : Object.keys(rows[className]).sort();
    var classNameTR = document.createElement('tr');
    var classNameTD = document.createElement('td');
    classNameTD.textContent = className;
    classNameTD.classList.add('class-name');
    if (memberNames === null) {
      var notImplimentTD = document.createElement('td');
      notImplimentTD.classList.add('class-notimpliment');
      classNameTR.appendChild(classNameTD);
      classNameTR.appendChild(notImplimentTD);
      table.appendChild(classNameTR);
    } else {
      var arrow = document.createElement('div');
      arrow.classList.add('arrow');
      arrow.classList.add(className + 'arrow');
      classNameTD.appendChild(arrow);
      classNameTR.style.cursor = 'pointer';
      classNameTR.appendChild(classNameTD);
      Object.keys(saveData).sort().forEach(browserName => {
        Object.keys(saveData[browserName]).sort((a, b) => (+b) - (+a)).forEach(version => {
          var classImpCntTD = document.createElement('td');
          classImpCntTD.classList.add('imp-cnt');
          var specCnt = Object.keys(saveData[browserName][version][className]).filter(x => saveData[browserName][version][className][x] === 'spec').length;
          if (memberNames.length) {
            classImpCntTD.style.background = heatColor(specCnt / memberNames.length)
            classImpCntTD.textContent = specCnt + ' / ' + memberNames.length;
          }
          classNameTR.appendChild(classImpCntTD);
        });
      });
      classNameTR.onclick = function () {
        [...document.getElementsByClassName(this.firstChild.textContent + 'member')].forEach(elm => elm.classList.toggle('collapse'));
        document.getElementsByClassName(this.firstChild.textContent + 'arrow')[0].classList.toggle('down');
      }
      table.appendChild(classNameTR);
      memberNames.forEach(memberName => {
        var memberTR = document.createElement('tr');
        memberTR.classList.add(className + 'member');
        memberTR.classList.add('collapse');
        var memberNameTD = document.createElement('td');
        memberTR.classList.add('membmer-row');
        memberTR.classList.add(rows[className][memberName]);
        memberNameTD.classList.add('member-name');
        memberNameTD.textContent = memberName;
        memberTR.appendChild(memberNameTD);
        Object.keys(saveData).sort().forEach(browserName => {
          Object.keys(saveData[browserName]).sort().forEach(version => {
            var memberTD = document.createElement('td');
            memberTD.id = browserName + version + className + memberName;
            memberTD.classList.add('member-null');
            window.tds[browserName + version + className + memberName] = memberTD;
            memberTR.appendChild(memberTD);
          });
        });
        table.appendChild(memberTR);
      });
    }
  });

  Object.keys(saveData).sort().forEach(browserName => {
    Object.keys(saveData[browserName]).sort((a, b) => (+b) - (+a)).forEach(version => {
      Object.keys(data[browserName][version]).sort().forEach(className => {
        if (data[browserName][version][className] === null) return;
        Object.keys(data[browserName][version][className]).sort().forEach(memberName => {
          var memberTD = window.tds[browserName + version + className + memberName];
          memberTD.classList.add('member-data');
          memberTD.classList.add(data[browserName][version][className][memberName]);
        });
      });
    });
  });
  delete window.tds;
  document.body.appendChild(table);
}
