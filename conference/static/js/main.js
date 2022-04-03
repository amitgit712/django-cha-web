console.log("main.js 200 OK");

var UserLable = document.querySelector('#lable-user');
var UserInput = document.querySelector('#user');
var JoinBtn = document.querySelector('#btn-join');

var User;

var webSocket;
var mapPeers = {};



// WEB SOCKET ON MESSAGE
function webSocketOnMessage(event) {
  var parsData = JSON.parse(event.data);
  var peerUser = parsData['peer'];
  var action = parsData['action'];
  if (User == peerUser) {
    return;
  }

  var receiver_channel_name = parsData['message']['receiver_channel_name'];
  if (action == 'new-peer') {
    createOffer(peerUser, receiver_channel_name);
    return;
  }
  if (action == 'new-offer') {
    var offer = parsData['message']['sdp'];
    createAnswer(offer, peerUser, receiver_channel_name);
    return;
  }
  if (action == 'new-answer') {
    var answer = parsData['message']['sdp'];
    var peer = mapPeers[peerUser][0];
    peer.setRemoteDescription(answer);
    return;
  }
}

JoinBtn.addEventListener('click', () => {
  User = UserInput.value;
  console.log('username is', User)

  if (User == '') {
    return;
    console.log('username requred')
  }

  UserInput.value = '';
  UserInput.disabled = true;
  UserInput.style.visibility = 'hidden';

  JoinBtn.disabled = true;
  JoinBtn.style.visibility = 'hidden';

  UserLable.innerHTML = User;

  var loc = window.location;
  var wsStart = 'ws://';
  if (loc.protocol == 'https:') {
    wsStart = 'wss://';
  }

  var endPoint = wsStart + loc.host + loc.pathname;
  console.log('END POINT: ', endPoint);

  webSocket = new WebSocket(endPoint);

  webSocket.addEventListener('open', (e) => {
    console.log('*** Connection opened ***');
    sendSignal('new-peer', {});
  });
  webSocket.addEventListener('message', webSocketOnMessage);
  webSocket.addEventListener('close', (e) => {
    console.log('*** Connection closed ***');

  });
  webSocket.addEventListener('error', (e) => {
    console.log('*** Some error occurred ***');
  });

});

var localStream = new MediaStream();

const constraints = {
  'video': true,
  'audio': true
};

const localVideo = document.querySelector('#local-video');

const btnAudio = document.querySelector('#btn-audio');
const btnVideo = document.querySelector('#btn-video');


var userMedia = navigator.mediaDevices.getUserMedia(constraints)
  .then(stream => {
    localStream = stream;
    localVideo.srcObject = localStream;
    localVideo.muted = true;
    localVideo.play()

    var audioTracks = stream.getAudioTracks();
    var videoTracks = stream.getVideoTracks();

    audioTracks[0].enabled = true;
    videoTracks[0].enabled = true;

    btnAudio.addEventListener('click', () => {
      audioTracks[0].enabled = !audioTracks[0].enabled;
      if (audioTracks[0].enabled) {
        btnAudio.innerHTML = 'audio mute'

        return;
      }
      btnAudio.innerHTML = 'audio unmute'
    });

    btnVideo.addEventListener('click', () => {
      videoTracks[0].enabled = !videoTracks[0].enabled;
      if (videoTracks[0].enabled) {
        btnVideo.innerHTML = 'video off'

        return;
      }
      btnVideo.innerHTML = 'video on'
    })

  })
  .catch(error => {
    console.log('Error while accessing media devices', error);
  })




// SEND MESSAGE
var msglist = document.querySelector('#msg-list');
var msgInput = document.querySelector('#msg');
var btnSendMsg = document.querySelector('#btn-send-msg');

btnSendMsg.addEventListener('click', sendMsgOnClick);

function sendMsgOnClick() {
  var message = msgInput.value;
  var li = document.createElement('li');
  li.appendChild(document.createTextNode('Me: ' + message));
  msglist.appendChild(li);

  var dataChannels = getDataChannel();

  message = User + ': ' + message

  for (index in dataChannels) {
    dataChannels[index].send(message);
  }

  msgInput.value = '';
}

// SEND SIGNAL
function sendSignal(action, message) {
  var jsonStr = JSON.stringify({
    'peer': User,
    'action': action,
    'message': message
  });
  webSocket.send(jsonStr);
}



// CREATE OFFER
function createOffer(peerUser, receiver_channel_name) {
  var peer = new RTCPeerConnection(null);

  addLocalTracks(peer);
  var dc = peer.createDataChannel('channel');
  dc.addEventListener('open', () => {
    console.log('Connection Opened');
  });
  dc.addEventListener('message', dcOnMessage);

  var remoteVideo = createvideo(peerUser);
  setOnTrack(peer, remoteVideo);
  mapPeers[peerUser] = [peer, dc];

  peer.addEventListener('iceconnectionstatechange', () => {
    var iceConnectionState = peer.iceConnectionState;
    if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed') {
      delete mapPeers[peerUser];

      if (iceConnectionState != 'closed') {
        peer.close();
      }
      removeVideo(remoteVideo);
    }
  });
  peer.addEventListener('icecandidate', (event) => {
    if (event.candidate) {
      console.log('New ice candidate: ', JSON.stringify(peer.localDescription));
      return;
    }
    sendSignal('new-offer', {
      'sdp': peer.localDescription,
      'receiver_channel_name': receiver_channel_name,
    })
  });
  peer.createOffer()
    .then(o => peer.setLocalDescription(o))
    .then(() => {
      console.log("Local Description set successfully ");
    })
}



// CREATE ANSWER
function createAnswer(offer, peerUser, receiver_channel_name) {
  var peer = new RTCPeerConnection(null);

  addLocalTracks(peer);

  var remoteVideo = createvideo(peerUser);
  setOnTrack(peer, remoteVideo);

  peer.addEventListener('datachannel', e => {
    peer.dc = e.channel;

    peer.dc.addEventListener('open', () => {
      console.log('Connection Opened');
    });
    peer.dc.addEventListener('message', dcOnMessage);

    mapPeers[peerUser] = [peer, peer.dc];


  })


  peer.addEventListener('iceconnectionstatechange', () => {
    var iceConnectionState = peer.iceConnectionState;
    if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed') {
      delete mapPeers[peerUser];

      if (iceConnectionState != 'closed') {
        peer.close();
      }
      removeVideo(remoteVideo);
    }
  });
  peer.addEventListener('icecandidate', (event) => {
    if (event.candidate) {
      console.log('New ice candidate: ', JSON.stringify(peer.localDescription));
      return;
    }
    sendSignal('new-answer', {
      'sdp': peer.localDescription,
      'receiver_channel_name': receiver_channel_name,
    })
  });
  peer.setRemoteDescription(offer)
    .then(() => {
      console.log('Remote description set successfully for: ', peerUser);
      return peer.createAnswer();
    })
    .then(a => {
      console.log('Answer created');
      peer.setLocalDescription(a)
    })
}

function addLocalTracks(peer) {
  localStream.getTracks().forEach(track => {
    peer.addTrack(track, localStream);
  });
  return;
}

function dcOnMessage(event) {
  var message = event.data;
  var li = document.createElement('li');
  li.appendChild(document.createTextNode(message));
  msglist.appendChild(li);
}


// CREATE VIDEO
function createvideo(peerUser) {
  var videoContainer = document.querySelector('#video-container');
  var remoteVideo = document.createElement('video');

  remoteVideo.id = peerUser + '-video';
  remoteVideo.autoplay = true;
  remoteVideo.playsInline = true;

  var videoWrapper = document.createElement('div');
  videoContainer.appendChild(videoWrapper);
  videoWrapper.appendChild(remoteVideo);
  return remoteVideo;
}


// SET ON TRACK 
function setOnTrack(peer, remoteVideo) {
  var remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;
  peer.addEventListener('track', async (event) => {
    remoteStream.addTrack(event.track, remoteStream);

  })
}


// REMOVE VIDEO
function removeVideo(video) {
  var videoWrapper = video.parentNode;
  videoWrapper.parentNode.removeChild(videoWrapper);
}


// DATA CHANNEL

function getDataChannel() {
  var dataChannels = []

  for (peerUser in mapPeers) {
    var dataChannel = mapPeers[peerUser][1]
    dataChannels.push(dataChannel);
  }
  return dataChannels
}
