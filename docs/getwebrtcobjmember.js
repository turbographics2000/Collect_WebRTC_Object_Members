var browser = detectBrowser(navigator.userAgent);
var browserMajorVersion = parseInt(browser.version);

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

getDocs().then(docs => {
  var TYPE_SPEC = 'spec';
  var TYPE_NOTSPEC = 'notspec';
  var TYPE_LEGACY = 'legacy';
  var parseData = WebIDLParse(docs);
  var specObjMembers = {};
  objMembers = {};
  var legacyCnt = 0;
  var specCnt = 0;
  var notSpecCnt = 0;
  var collect = function (type, className) {
    objMembers[className] = {};
    if (window[className]) {
      Object.keys(window[className].prototype).forEach(memberName => {
        if (!Object.keys(parseData[type][className]).includes(memberName)) {
          legacyCnt++;
          objMembers[className][memberName] = TYPE_LEGACY;
        }
      });
      Object.keys(parseData[type][className]).forEach(memberName => {
        if (memberName in window[className].prototype) {
          specCnt++;
          objMembers[className][memberName] = TYPE_SPEC;
        } else {
          notSpecCnt++;
          objMembers[className][memberName] = TYPE_NOTSPEC;
        }
      });
    }
  }

  Object.keys(parseData.Dictionary).forEach(className => collect('Dictionary', className));
  Object.keys(parseData.Interface).forEach(className => collect('Interface', className));

  buildTable(objMembers);
});

function buildTable(objMembers) {
  var colSpan = 1;
  Object.keys(objMembers).forEach(browserName => {
    colSpan += Object.keys(objMembers[browserName]).length;
  });

  var saveData = {};

  var table = document.createElement('table');
  var headerTR = document.createElement('tr');
  var headerSpacerTD = document.createElement('td');
  headerTR.appendChild(headerSpacerTD);
  table.appendChild(headerTR);

  var data = JSON.parse(localStorage.getItem('data') || null) || {};
  data[browser.name][browserMajorVersion] = objMembers;

  var rows = {};
  Object.keys(data).sort().forEach(browserName => {
    saveData[browserName] = data[browserName];
    var browserHeaderTD = document.createElement('td');
    browserHeaderTD.className = browserName;
    var browserNameDiv = document.createElement('div');
    bowserNameDiv.className = 'browser-name';
    browserNameDiv.textContent = browserName;
    var browserVersionDiv = document.createElement('div');
    browserVersionDiv.className = 'browser-version';
    browserVersionDiv.textContent = version;
    browserHeaderTD.appendChild(browserNameDiv);
    browserHeaderTD.appendChild(browserVersionDiv);
    headerTR.appendChild(browserHeaderTD);

    Object.keys(data[browserName]).sort((a, b) => (+b) - (+a)).splice(0, 3).forEach(version => {
      saveData[browserName][version] = data[browserName][version];
      Object.keys(data[browserName][version]).sort().forEach(className => {
        rows[className] = {};
        Object.keys(data[browserName][version][className]).sort().forEach(memberName => {
          rows[className][memberName] = data[browserName][version][className][memberName];
        });
      });
    });
  });

  rows.forEach(className => {
    var classNameTR = documeent.createElement('tr');
    var classNameTD = document.createElement('td');
    classNameTD.colSpan = colSpan;
    classNameTD.classList.add('class-name');
    classNameTR.appendChild(classNameTD);
    table.appendChild(classNameTR);
    Object.keys(rows[className]).sort().forEach(memberName => {
      var memberTR = document.createElement('tr');
      var memberNameTD = document.createElement('td');
      memberTR.classList.add('membmer-row');
      memberTR.classList.add(rows[className][memberName].type);
      memberNameTD.classList.add('member-name');
      memberNameTD.textContent = memberName;
      memberTR.appendChild(memberTD);
      Object.keys(saveData).sort().forEach(browserName => {
        Object.keys(saveData[browserName]).sort().forEach(version => {
          var memberTD = document.createElement('td');
          memberTD.id = browserName + version + className + memberName;
          memberTD.classList.add('member-null');
          memberTR.appendChild(memberTD);
        });
      });
      table.appendChild(memberTR);
    });
  });

  Object.keys(saveData).sort().forEach(browserName => {
    Object.keys(saveData[browserName]).sort((a, b) => (+b) - (+a)).forEach(version => {
      Object.keys(data[browserName][version]).sort().forEach(className => {
        Object.keys(data[browserName][version][className]).sort().forEach(memberName => {
          var memberTD = document.createElement(browserName + version + className + memberName);
          memberTD.classList.remove('member-null');
          memberTD.classList.add(data[browserName][version][className][memberName]);
        });
      });
    });
  });

  document.body.appendChild(table);
}
