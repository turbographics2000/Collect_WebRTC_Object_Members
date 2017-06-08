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
                if(legacySection) legacySection.parentElement.removeChild(legacySection);
                docs.push(doc);
                return docs;
            });
    });
    return promise;
}

getDocs().then(docs=> {
    var data = WebIDLParse(docs);
    objMembers = {};
    Object.keys(data.Dictionary).concat(Object.keys(data.Interface)).sort().forEach(className => {
        objMembers[className] = window[className] ? Object.keys(window[className].prototype).sort() : null;
    });
    var json = JSON.stringify(objMembers, null, 2).replace(/"/g, '');
    var blob = new Blob([json], { type: 'text/plain' });
    dl.style.display = '';
    dl.download = `WebRTC_Object_members.txt`;
    dl.href = URL.createObjectURL(blob);
});
