import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';

import io from 'socket.io-client';
import axios from 'axios';

class App extends Component {

  constructor(props) {
    
    super(props);

    this.state = {
      socket: io('http://localhost:3000', {
        transports: ['websocket']
      }),
      remoteVide: null,
      localVideo: null,
      peerConnection: null,
      hasAddTrack: false,
      mediaConstraints: {
          audio: true,
          video: {
              facingMode: 'user',
          },
      },
      username: '',
      users: [],
      iceServers: [],
    }

    this.handleTrackEvent = this.handleTrackEvent.bind(this);
    this.handleAddStreamEvent = this.handleAddStreamEvent.bind(this);
    // this.handleNegotiationNeededEvent = this.handleNegotiationNeededEvent.bind(this);
    // this.onIceCandidate = this.onIceCandidate.bind(this);
    // this.onIceStateChange = this.onIceStateChange.bind(this);
    this.receiveCallRequest = this.receiveCallRequest.bind(this);
    this.receiveCallAccept = this.receiveCallAccept.bind(this);
    this.handleChangeUsername = this.handleChangeUsername.bind(this);
    this.handleVideoCall = this.handleVideoCall.bind(this);
    this.fetchUsers = this.fetchUsers.bind(this);
    this.handleJoin = this.handleJoin.bind(this);
    this.startCall = this.startCall.bind(this);

  }

  handleChangeUsername(evt){
    this.setState({username: evt.target.value});
  }

  handleJoin(evt) {
    var data = {};
    data.username = document.querySelector('#username').value;
    this.state.socket.emit('join', data);
  }

  handleVideoCall(evt){
    console.log(evt.currentTarget.getAttribute('data-username'));
    this.startCall(evt.currentTarget.getAttribute('data-username'));
  }

  handleTrackEvent(event) {
      console.log("*** Track event");
      this.remoteVideo.srcObject = event.streams[0];
  }

  handleAddStreamEvent(event) {
      console.log("*** Stream added");
      this.remoteVideo.srcObject = event.stream;
  }

  // handleNegotiationNeededEvent(callee) {
  //     console.log("*** Negotiation needed");
  //     console.log("---> Creating offer");

  //     var {peerConnection} = this.state;

  //     peerConnection.createOffer().then(function(offer) {
  //             console.log("---> Creating new description object to send to remote peer");
  //             return peerConnection.setLocalDescription(offer);
  //         })
  //         .then(function() {
  //             console.log("---> Sending offer to remote peer");

  //             this.state.socket.emit('', {
  //                 from: this.state.username,
  //                 to: callee,
  //                 on: 'on-callrequest',
  //                 desc: JSON.stringify(peerConnection.localDescription),
  //             });
  //         })
  //         .catch(function(err) {
  //             console.log(err, 'Error creating offer..');
  //         });

  //     this.setState({
  //       peerConnection: peerConnection
  //     });
  // }

  // onIceCandidate(event, callee) {

  //   if (event.candidate) {
  //       this.state.socket.emit('', {
  //           from: this.state.username,
  //           to: callee,
  //           on: 'on-addicecandidate',
  //           candidate: JSON.stringify(event.candidate),
  //       });
  //   }
  // }

  // onIceStateChange(calee) {
  //     //console.log('ICE CHANGE');
  // }

  receiveCallRequest(callee, desc) {
    console.log('Call requested...');
    
    var hasAddTrack;

    var desc = JSON.parse(desc);

    var {socket, username, peerConnection, localVideo} = this.state

    peerConnection.onicecandidate = (evt) => {
      if (evt.candidate) {
          socket.emit('add-icecandidate', {
              from: username,
              to: callee,
              candidate: JSON.stringify(evt.candidate),
          });
      }
    }
    peerConnection.oniceconnectionstatechange = (evt) => {
      // this.onIceStateChange(callee);
    }
    peerConnection.onnegotiationneeded = (evt) => {
      console.log("*** Negotiation needed");
      console.log("---> Creating offer");

      peerConnection.createOffer().then(function(offer) {
              console.log("---> Creating new description object to send to remote peer");
              return peerConnection.setLocalDescription(offer);
          })
          .then(function() {
              console.log("---> Sending offer to remote peer");

              socket.emit('call-request', {
                  from: username,
                  to: callee,
                  desc: JSON.stringify(peerConnection.localDescription),
              });
          })
          .catch(function(err) {
              console.log(err, 'Error creating offer..');
          });
    }
    
    hasAddTrack = (peerConnection.addTrack !== undefined);
    // if (hasAddTrack) {
    //     peerConnection.ontrack = this.handleTrackEvent;
    // } else {
    //     peerConnection.onaddstream = this.handleAddStreamEvent;
    // }

    var descRemote = new RTCSessionDescription(desc);
    peerConnection.setRemoteDescription(descRemote).then(() => {
            console.log("Setting up the local media stream...");
            return navigator.mediaDevices.getUserMedia(this.state.mediaConstraints);
        })
        .then((localStream) => {
            console.log("-- Local video stream obtained");
            localVideo.src = window.URL.createObjectURL(localStream);
            localVideo.srcObject = localStream;
            if (hasAddTrack) {
                console.log("-- Adding tracks to the RTCPeerConnection");
                localStream.getTracks().forEach(track =>
                    peerConnection.addTrack(track, localStream)
                );
            } else {
                console.log("-- Adding stream to the RTCPeerConnection");
                peerConnection.addStream(localStream);
            }
        })
        .then(() => {
            console.log("------> Creating answer");
            // Now that we've successfully set the remote description, we need to
            // start our stream up locally then create an SDP answer. This SDP
            // data describes the local end of our call, including the codec
            // information, options agreed upon, and so forth.
            return peerConnection.createAnswer();
        })
        .then((answer) => {
            console.log("------> Setting local description after creating answer");
            // We now have our answer, so establish that as the local description.
            // This actually configures our end of the call to match the settings
            // specified in the SDP.
            return peerConnection.setLocalDescription(answer);
        })
        .then(() => {

            // We've configured our end of the call now. Time to send our
            // answer back to the caller so they know that we want to talk
            // and how to talk to us.
            console.log("Sending answer packet back to other peer");
            //sendToServer(msg);
            //
            socket.emit('call-accept', {
                from: username,
                to: callee,
                desc: JSON.stringify(peerConnection.localDescription),
            });
        })
        .catch((err) => {
            console.log(err, 'Error in accepting remote connection..');
        });

  }

  receiveCallAccept(from, desc) {
      console.log('Call accepted...');
      var desc = JSON.parse(desc);
      var remoteDesc = new RTCSessionDescription(desc);
      this.peerConnection.setRemoteDescription(remoteDesc).catch(function(err) {
          console.log(err, 'Error accepting call...')
      });
  }

  fetchUsers() {

    axios.get('http://localhost:3000/users')
      .then((res) => {
        this.setState({users: res.data.users});
      })
      .catch((err) => {
        console.log(err);
      });

  }

  fetchIceServers() {

      axios.get('http://localhost:3000/twilio/servers')
      .then((res) => {
        var servers = [];
        
        res.data.iceServers.forEach((i) => {
          var temp = {};
          temp.urls = i.url;
          if(i.username){
            temp.username = i.username;
            temp.credential = i.credential;
          }
          servers.push(temp);
        });
        this.setState({
          peerConnection: new RTCPeerConnection({
              iceServers: servers
          }),
        });

      })
      .catch((err) => {
        console.log(err);
      });

  }

  startCall(callee) {

    console.log('Starting call...');

    var hasAddTrack; 
    
    var {socket, username, peerConnection} = this.state

    peerConnection.onicecandidate = (evt) => {
      if (evt.candidate) {
          socket.emit('add-icecandidate', {
              from: username,
              to: callee,
              candidate: JSON.stringify(evt.candidate),
          });
      }
    }
    peerConnection.oniceconnectionstatechange = (evt) => {
      // this.onIceStateChange(callee);
    }
    peerConnection.onnegotiationneeded = (evt) => {
      console.log("*** Negotiation needed");
      console.log("---> Creating offer");

      peerConnection.createOffer().then(function(offer) {
              console.log("---> Creating new description object to send to remote peer");
              return peerConnection.setLocalDescription(offer);
          })
          .then(function() {
              console.log("---> Sending offer to remote peer");

              socket.emit('call-request', {
                  from: username,
                  to: callee,
                  desc: JSON.stringify(peerConnection.localDescription),
              });
          })
          .catch(function(err) {
              console.log(err, 'Error creating offer..');
          });
    }
    
    hasAddTrack = (peerConnection.addTrack !== undefined);
    // if (hasAddTrack) {
    //     peerConnection.ontrack = this.handleTrackEvent;
    // } else {
    //     peerConnection.onaddstream = this.handleAddStreamEvent;
    // }

    console.log('requesting webcam access...');

    navigator.mediaDevices.getUserMedia(this.state.mediaConstraints).then(localStream => {
        console.log("-- Local video stream obtained");
        
        var {localVideo} = this.state;
        localVideo.src = window.URL.createObjectURL(localStream);
        localVideo.srcObject = localStream;

        this.setState({
          localVideo: localVideo
        });

        if (hasAddTrack) {
            console.log("-- Adding tracks to the RTCPeerConnection");
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        } else {
            console.log("-- Adding stream to the RTCPeerConnection");
            peerConnection.addStream(localStream);
        }
    }).catch(function(err) {
        alert(err);
    });

  }

  componentDidMount() {

    const {socket} = this.state;

    this.fetchIceServers();
    this.fetchUsers();

    this.setState({
      localVideo: document.querySelector('#local_video'),
      remoteVide: document.querySelector('#peer_video'),
    });

    socket.on('users-connected', (data) => {
        
        console.log('user connected', data);
        this.setState({users: data.users});

    });

    socket.on('call-request', (data) => {
      const {username} = this.state;
      
      if(data.to === username){
        console.log('Requesting call...');
        this.receiveCallRequest(data.to, data.desc);
      }
    });

    socket.on('call-accept', (data) => {
      const {username} = this.state;

      if(data.to === username){
        console.log('Accepting call...');
      }
    });

    socket.on('add-icecandidate', (data) => {
      const {username} = this.state;

      if(data.to === username){
        console.log('Adding ice candidate...');
        var iceCandidate = JSON.parse(data.candidate);
        var {peerConnection} = this.state;

        peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate),
        () => {
            console.log('Success setting ice candidate..');
        },
        (err) => {
            console.log(err);
        });
      }
    });
  }

  render() {
    
    return (
      <div className="row">
          <div className="col s4 offset-s4">
              <div className="card-panel">
                  <input id="username" type="text" name="username" placeholder="Username" onChange={this.handleChangeUsername} />
                  <button onClick={this.handleJoin} id="join" className="btn fullwidth">Join</button>
              </div>
          </div>
          <div className="col s12">
              <ul className="collection with-header">
                  <li className="collection-header">
                      <h6>Users connected</h6>
                  </li>
                  {this.state.users.map(user => {
                    return <li key={user.username} className="collection-item">
                      <div>
                      { user.username }
                      <a href="#!" onClick={this.handleVideoCall} data-username={user.username} className="secondary-content">
                        <i className="material-icons">
                        video_call
                        </i>
                      </a>
                      </div>
                    </li>
                  })}
              </ul>
          </div>
          <div className="col s12">
              <video id="peer_video" autoPlay></video>
          </div>
          <div className="col cols4 offset-s4">
              <video id="local_video" autoPlay></video>
          </div>
      </div>
    );
  }


}

export default App;
