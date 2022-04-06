
 //webkitURL is deprecated but nevertheless
URL = window.URL || window.webkitURL;

var api_address = null;
var session_key = "test_session";
var _testing = false;

function connect_to_server(){
  var window_address = new URL(window.location.href);
  var _server_address = window_address.searchParams.get("server_address");
  var _session_key = window_address.searchParams.get("session_key");
  if(_server_address != null){
    console.log(_server_address);
    if(_server_address.startsWith("https://expressivecloning.github.io/app.html?server_address=")){
      _server_address = _server_address.replace("https://expressivecloning.github.io/app.html?server_address=", "");
    }
    _server_address = _server_address.replace("http://", "https://");
    if ( ! _server_address.startsWith("https://")){
      _server_address = "https://" + _server_address;
    }
    api_address = _server_address;
    fetch(api_address + "/test_connection").then(results => {
      if (results['status'] == 200){
        if(_session_key != null){
          session_key = _session_key;  
        }
        $("#whole_container").css('display','');
        return Swal.fire({
            icon: 'success',
            title: 'Connection Established with Model server!',
            text: 'Connected to server ' + api_address + ' .You may now record and upload your audio :)',
            confirmButtonColor: '#008080'
        })
      }
      else{
        throw("Exception");
      }
    }).catch(err => {
      Swal.fire({
        icon: 'error',
        title: 'Could not connect to server! Please refresh the page and try again.',
        confirmButtonColor: '#008080'
      });
    });
    return;
  }

  if(_testing){
    $("#whole_container").css('display','');
    $("#style_transfer_results_div").css('display','');
    return;
  }

  Swal.fire({
    width: 700,
    html: '<h4>Launch a model server using our <a href="https://colab.research.google.com/notebook#fileId=1XDVJRpD2INue9LKJHSwHhUYAd9-gtq9E&offline=true&sandboxMode=true" target="_blank">google colab notebook</a> (should take a couple of minutes to setup) and paste the address here.</h4>',
    input: "text",
    confirmButtonText: 'Connect',
    confirmButtonColor: '#008080'
  })
  .then(name => {
    if (!name) throw null;
    _address = name.value;
    _address = _address.replace("http://", "https://");
    if ( ! _address.startsWith("https://")){
      _address = "https://" + _address;
    }
    api_address = _address;
    return fetch(api_address + "/test_connection");
  })
  .then(results => {
      console.log("Results", results);
      if (results['status'] == 200){
          $("#whole_container").css('display','');
          return Swal.fire({
            icon: 'success',
            title: 'Connection Established with Model server!',
            text: 'Connected to server ' + api_address + ' .You may now record and upload your audio :)',
            confirmButtonColor: '#008080'
          })
      }
      else{
          throw("Exception");
      }

  })
  .catch(err => {
    Swal.fire({
      icon: 'error',
      title: 'Could not connect to server! Please refresh the page and try again.',
      confirmButtonColor: '#008080'
    });
  });
}


// connect_to_server();

api_address = "https://2afd-34-80-133-245.ngrok.io"
$("#whole_container").css('display','');



var gumStream;                      //stream from getUserMedia()
var recorder;                       //WebAudioRecorder object
var input;                          //MediaStreamAudioSourceNode  we'll be recording
var encodingType;                   //holds selected encoding for resulting audio (file)
var encodeAfterRecord = true;       // when to encode

// shim for AudioContext when it's not avb. 
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext; //new audio context to help us record

var encodingTypeSelect = document.getElementById("encodingTypeSelect");
var finetuneinterval = null;

var zeroshot_style_results_flag = false;
var fine_tune_global_flag = false;
var fine_tune_triggered = false;
// var recordButton = document.getElementById("recordButton");
// var stopButton = document.getElementById("stopButton");

//add events to those 2 buttons

var transcripts_all = [
"Police were called to the scene, according to the weekend reports.",
"There was a tremendous amount of anger and frustration in that music.",
"It would still have been a good film, but very different.",
"That review will look at management across the sector as a whole.",
"Naturally, it was not difficult to find support for these proposals.",
"Since backboned animals are best known to most readers, they may be taken as an illustration.",
"The rainbow is a division of white light into many beautiful colors.",
"Out beyond ideas of wrongdoing and rightdoing there is a field, I'll meet you there.",
"He also has property interests in the country.",
"The committee will meet this afternoon for a special debate."
]

var total_uploaded = 0;
var examples_per_batch = 5;
var transcripts = [];
for(var i=0; i < examples_per_batch; i++){
    transcripts.push(transcripts_all[i]);
}

// var transcripts = [
// "The rainbow is a division of white light into many beautiful colors.",
// "Float the soap on top of the bath water. ",
// "The committee will meet this afternoon for a special debate.",
// "I am used to working all night, and sleeping all day.",
// "The house door stood open, and the rooms were all so empty.",
// "The square wooden crate was packed to be shipped.",
// "Police were called to the scene, according to the weekend reports.",
// "Out beyond ideas of wrongdoing and rightdoing there is a field, I'll meet you there.",
// "They are, however, allowed to change, only it must be a complete change.",
// "Then he gave me the key of the room, and left me with a thousand books."
// ]



var all_blobs = [];

for(var row = 0; row < examples_per_batch; row ++){
    all_blobs.push(null);
    var recording_table_html = "<tr><td>" + (row + 1) + "</td><td style='width:500px;' id='transcript_display_" + row  +  "'  >"+ transcripts[row] +"</td><td><button id='recordButton_" + row + "'>Record</button></td>"
    recording_table_html += "<td><button id='stopButton_" + row + "'>Stop</button></td><td id ='recordingholder_" + row + "' ></td></tr>"
    $("#user_recordings").append(recording_table_html)  
}


var recordButtons = [];
for(var record_button_no = 0; record_button_no < examples_per_batch; record_button_no ++){
    recordButtons.push( document.getElementById("recordButton_" + record_button_no) );
    recordButtons[record_button_no].addEventListener("click", function() {
        startRecording(this.id);
    }); 
}


var stopButtons = [];
for(var stop_button_no = 0; stop_button_no < examples_per_batch; stop_button_no++){
    stopButtons.push( document.getElementById("stopButton_" + stop_button_no) );
    stopButtons[stop_button_no].addEventListener("click", function() {
        stopRecording(this.id);
    });
}


$("#uploadButton").click(function(){
    upload();
});



function startRecording(recorder_id) {
    recorder_no = recorder_id.split("_")[1]
    console.log("startRecording() called");

    /*
        Simple constraints object, for more advanced features see
        https://addpipe.com/blog/audio-constraints-getusermedia/
    */
    
    var constraints = { audio: true, video:false }

    /*
        We're using the standard promise based getUserMedia() 
        https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    */

    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
        __log("getUserMedia() success, stream created, initializing WebAudioRecorder...");

        /*
            create an audio context after getUserMedia is called
            sampleRate might change after getUserMedia is called, like it does on macOS when recording through AirPods
            the sampleRate defaults to the one set in your OS for your playback device

        */
        audioContext = new AudioContext();

        //update the format 
        document.getElementById("formats").innerHTML="Format: 2 channel "+encodingTypeSelect.options[encodingTypeSelect.selectedIndex].value+" @ "+audioContext.sampleRate/1000+"kHz"

        //assign to gumStream for later use
        gumStream = stream;
        
        /* use the stream */
        input = audioContext.createMediaStreamSource(stream);
        
        //stop the input from playing back through the speakers
        //input.connect(audioContext.destination)

        //get the encoding 
        encodingType = encodingTypeSelect.options[encodingTypeSelect.selectedIndex].value;
        
        //disable the encoding selector
        encodingTypeSelect.disabled = true;

        recorder = new WebAudioRecorder(input, {
          workerDir: "js/", // must end with slash
          encoding: encodingType,
          numChannels:1, //2 is the default, mp3 encoding supports only 2
          onEncoderLoading: function(recorder, encoding) {
            // show "loading encoder..." display
            __log("Loading "+encoding+" encoder...");
          },
          onEncoderLoaded: function(recorder, encoding) {
            // hide "loading encoder..." display
            __log(encoding+" encoder loaded");
          }
        });

        recorder.onComplete = function(recorder, blob) { 
            __log("Encoding complete");
            console.log("Recording complete", recorder_id);
            createDownloadLink(blob,recorder.encoding, recorder_no);
            encodingTypeSelect.disabled = false;
        }

        recorder.setOptions({
          timeLimit:120,
          encodeAfterRecord:encodeAfterRecord,
          ogg: {quality: 0.5},
          mp3: {bitRate: 160}
        });

        //start the recording process
        recorder.startRecording();

         __log("Recording started");

    }).catch(function(err) {
        console.log(err)
        //enable the record button if getUSerMedia() fails
        recordButton.disabled = false;
        stopButton.disabled = true;

    });

    //disable the record button
    for(var rbi = 0; rbi < recordButtons.length; rbi++){
        recordButtons[rbi].disabled = true
        stopButtons[rbi].disabled = false;
    }
    

    
}

function stopRecording() {
    console.log("stopRecording() called");
    
    //stop microphone access
    gumStream.getAudioTracks()[0].stop();

    //disable the stop button
    for(var sbi = 0; sbi < examples_per_batch; sbi ++){
        stopButtons[sbi].disabled = true;   
        recordButtons[sbi].disabled = false;
    }
    

    
    
    //tell the recorder to finish the recording (stop recording + encode the recorded audio)
    recorder.finishRecording();

    __log('Recording stopped');
}

function createDownloadLink(blob,encoding, recorder_no) {
    // upload(blob);
    all_blobs[recorder_no] = blob;
    console.log("Creating download link", recorder_no)
    var url = URL.createObjectURL(blob);
    var au = document.createElement('audio');
    var li = document.createElement('li');
    var link = document.createElement('a');
    var td = document.getElementById("recordingholder_" + recorder_no);
    td.innerHTML = "";
    //add controls to the <audio> element
    au.controls = true;
    au.src = url;

    //link the a element to the blob
    link.href = url;
    link.download = new Date().toISOString() + '.'+encoding;
    link.innerHTML = link.download;

    //add the new audio and a elements to the li element
    // li.appendChild(au);
    li.appendChild(link);

    td.appendChild(au);
    //add the li element to the ordered list
    recordingsList.appendChild(li);
}



//helper function
function __log(e, data) {
    log.innerHTML += "\n" + e + " " + (data || '');
}




function get_audio_from_text(text){
    text = text.trim();
    if(! text.endsWith(".")){
        text = text += ".";
    }
    $("#tts_button").prop('disabled', true);
    $("#tts_button").html('Loading..');
    $.ajax({
      url: api_address + '/get_audio_from_text',
      data: {
        'text': text,
        'session_key' : session_key
      },
      dataType: 'json',
      success: function(data) {
        console.log(data);
        audio_html = '<audio style="width:250px;" controls src="data:audio/ogg;base64,' + data['audio_base64_zeroshot'] + '"></audio>'
        $("#text_to_speech_zeroshot").html(audio_html)

        if(data['audio_base64_adaption'] != null){
            audio_html = '<audio style="width:250px;" controls src="data:audio/ogg;base64,' + data['audio_base64_adaption'] + '"></audio>'
            $("#text_to_speech_finetuning").html(audio_html);
        }
        console.log("TTS success");
        $("#tts_button").prop('disabled', false);
        $("#tts_button").html('Synthesize');
      },
      error: function(err) {
        console.log(err);
        $("#tts_button").prop('disabled', false);
        $("#tts_button").html('Synthesize');
      },
      type: 'GET'
    });
}


function update_transcripts_in_table(){

}

function upload(){
    for(var rn = 0; rn < examples_per_batch; rn++){
        if(all_blobs[rn] == null){
            alert("Please record all transcripts and then press upload!")
            return;
        }
    }

    $("#uploadButton").html("Uploading...");
    $("#uploadButton").prop("disabled", true);

    var xhr=new XMLHttpRequest();
    xhr.onload=function(e) {
    if(this.readyState === 4) {
        fine_tune_global_flag = false;
        fine_tune_triggered = false;
        console.log("Server returned: ",e.target.responseText);
        Swal.fire({
            icon: 'success',
            title: 'Speaker Profile Created!',
            text : "Loading style transfer results..",
            confirmButtonColor: '#008080'
        });
        
        $("#uploadButton").html("Upload");
        $("#uploadButton").prop("disabled", false);
        total_uploaded += examples_per_batch;
    }
    };
    var fd=new FormData();
    fd.append("n_already_uploaded", total_uploaded);
    fd.append("total_wavs", examples_per_batch);
    fd.append("session_key", session_key);

    for(var rn = 0; rn < examples_per_batch; rn++){
        var audio_key = "audio_data_" + rn;
        var transcript_key = "transcript_" + rn;
        fd.append(audio_key, all_blobs[rn], "filename.wav");    
        fd.append(transcript_key, transcripts[rn]); 

    }
    
    xhr.open("POST", api_address + "/submit_recordings",true);
    xhr.send(fd);
 }






