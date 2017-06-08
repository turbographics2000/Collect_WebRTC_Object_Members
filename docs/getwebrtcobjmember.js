objMembers = {};
['RTCCertificate', 'RTCDataChannel', 'RTCDataChannelEvent', 'RTCIceCandidate', 'RTCPeerConnection', 'RTCPeerConnectionIceEvent', 'RTCRtpContributingSource', 'RTCRtpReceiver', 'RTCSessionDescription', 'RTCStatsReport', 'webkitRTCPeerConnection'].forEach(className => {
    objMembers[className] = Object.keys(window[className].prototype).sort();
});
var json = JSON.stringify(objMembers, null, 2).replace(/"/g, '');
var blob = new Blob([json], { type: 'text/plain' });
dl.download = `WebRTC_Object_members.txt`;
dl.href = URL.createObjectURL(blob);
