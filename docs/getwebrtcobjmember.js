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

var data = WebIDLParse(docs);
objMembers = {};
Object.keys(data.Dictionary).forEach(className => {
    objMembers[className] = Object.keys(window[className].prototype).sort();
});
Object.keys(data.Interface).forEach(className => {
    objMembers[className] = Object.keys(window[className].prototype).sort();
});
var json = JSON.stringify(objMembers, null, 2).replace(/"/g, '');
var blob = new Blob([json], { type: 'text/plain' });
dl.download = `WebRTC_Object_members.txt`;
dl.href = URL.createObjectURL(blob);
