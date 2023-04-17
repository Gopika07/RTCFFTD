import { BrowserClient } from "//unpkg.com/@speechly/browser-client?module=true"

let APP_ID = "d4aac36cfd244d2cb5f2250fdbb609c6"

const speechly = new BrowserClient({
    appId: "1e3253c8-98c1-4088-abe5-a769912bacf4",
    debug: true,
    logSegments: true,
    vad: {
        enabled: true,
        noiseGateDb: -24.0
    }
});

let token = null;
let uid = String(Math.floor(Math.random() * 10000))

let client;
let channel;

let leftuser = document.getElementById('user-1')
let rightuser = document.getElementById('user-2')

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if(!roomId){
    window.location = 'lobby.html'
}

let localStream;
let remoteStream;
let peerConnection;

const servers = {
    iceServers:[
        {
            urls:['stun:stun1.1.google.com:19302', 'stun:stun2.1.google.com:19302']
        }
    ]
}



let init = async () => {
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({uid, token})

    // const model = await tf.loadLayersModel('C:/Users/user/OneDrive/Desktop/PeerChat2/WebRTC-20230311T220329Z-001/WebRTC/model/model1.h5');

    channel = client.createChannel(roomId)
    await channel.join()

    channel.on('MemberJoined', handleUserJoined)
    channel.on('MemberLeft', handleUserLeft)
    client.on('MessageFromPeer', handleMessageFromPeer)
    client.on('channelMessage', handleChannelMessage)


    localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:true})
    document.getElementById('user-1').srcObject = localStream
    await speechly.attach(localStream);
    localStream.video.controls = false;
    if(localStream){
        streamContainer.insertBefore(localStream.video, streamsContainer.firstChild);
    }   

}

const transcriptContainer = document.getElementById("transcript");

speechly.onSegmentChange(segment => {
    if(segment && segment.isFinal){
        let text = segment.words.map(w => w.value.toLowerCase()).join(" ");
        let div = document.createElement("div");
        div.textContent = text;
        transcriptContainer.appendChild(div);
    }
});

let handleUserLeft = (MemberId) => {
    document.getElementById('user-2').style.display = 'none'
    document.getElementById('user-1').classList.remove('smallFrame')

}

let handleMessageFromPeer = async (message, MemberId) => {

    message = JSON.parse(message.text)

    if(message.type === 'offer'){
        createAnswer(MemberId, message.offer)
    }

    if(message.type === 'answer'){
        addAnswer(message.answer)
    }

    if(message.type === 'candidate'){
        if(peerConnection){
            peerConnection.addIceCandidate(message.candidate)
        }
    }
}

let handleUserJoined = async (MemberId) => {
    console.log("A new user joined the channel:", MemberId)
    createOffer(MemberId)
}

let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(servers)

    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream
    document.getElementById('user-2').style.display = 'block'

    document.getElementById('user-1').classList.add('smallFrame')

    if(!localStream){
        localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:true})
        document.getElementById('user-1').srcObject = localStream    
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) =>
        {
            remoteStream.addTrack(track)
        })
    }

    peerConnection.onicecandidate = async (event) => {
        if(event.candidate){
            client.sendMessageToPeer({text:JSON.stringify({'type':'candidate', 'candidate':event.candidate})}, MemberId)
        }
    }

    // sendChannel.client = peerConnection.client.createDataChannel("sendChannel")

}

let createOffer = async (MemberId) => {
    await createPeerConnection(MemberId)

    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    client.sendMessageToPeer({text:JSON.stringify({'type':'offer', 'offer':offer})}, MemberId)
}

let createAnswer = async (MemberId, offer) => {
    await createPeerConnection(MemberId)

    await peerConnection.setRemoteDescription(offer)

    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    client.sendMessageToPeer({text:JSON.stringify({'type':'answer', 'answer':answer})}, MemberId)
}

let addAnswer = async (answer) => {
    if(!peerConnection.currentRemoteDescription){
        peerConnection.setRemoteDescription(answer)
    }
}

let handleChannelMessage = async (messageData, MemberId) => {
    console.log('A new message was recieved')
    let data = JSON.parse(messageData.text)
    console.log('Message:', data)
}

let sendMessage = async () =>{
    e.preventDefault()

    let message = e.target.message.value
    channel.sendMessage({text:JSON.stringify({'type':'chat', 'message':message, 'displayName':displayName})})

    e.target.reset()
}

let addMessageToDom = (name, message) => {
    let messagesWrapper = document.getElementById('messages')
    
}

let leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if(videoTrack.enabled){
        videoTrack.enabled = false
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    }else{
        videoTrack.enabled = true
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    if(audioTrack.enabled){
        audioTrack.enabled = false
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    }else{
        audioTrack.enabled = true
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}

leftuser.onplay = function() {
    var stream = leftuser.captureStream();
    rightuser.srcObject = stream;
}



window.addEventListener('beforeunload', leaveChannel)

let messageForm = document.getElementById('message_form')
messageForm.addEventListener('submit', sendMessage)

document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)

init()