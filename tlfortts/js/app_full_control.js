
 //webkitURL is deprecated but nevertheless
URL = window.URL || window.webkitURL;

var api_address = null;


function connect_to_server(){
    swal({
      text: 'Enter server address:',
      content: "input",
      button: {
        text: "Connect!",
        closeModal: false,
      },
    })
    .then(name => {
      if (!name) throw null;
      api_address = name;
      return fetch(api_address + "/test_connection");
    })
    .then(results => {
        if (results['status'] == 200){
            $("#whole_container").css('display','');
            return swal("Connection Established!");
        }
        else{
            throw("Exception");
        }

    })
    .catch(err => {

      if (err) {
        swal("Could Not connect to server", "error");
        // connect_to_server();
      } else {
        swal.stopLoading();
        swal.close();
      }
      // $("body").append('<div id="overlay" style="background-color:grey;position:absolute;top:0;left:0;height:100%;width:100%;z-index:999"></div>')
    });
}


function set_session_key(){
    swal({
      text: 'Enter Session Key:',
      content: "input",
      button: {
        text: "Connect!",
        closeModal: false,
      },
    })
    .then(name => {
      if (!name) throw null;
      api_address = name;
      return fetch(api_address + "/test_connection");
    })
    .then(results => {
        if (results['status'] == 200){
            return swal("Connection Established!")
        }
        else{
            throw("Exception");
        }

    })
    .catch(err => {

      if (err) {
        swal("Could Not connect to server", "error");
        // connect_to_server();
      } else {
        swal.stopLoading();
        swal.close();
      }
      // $("body").append('<div id="overlay" style="background-color:grey;position:absolute;top:0;left:0;height:100%;width:100%;z-index:999"></div>')
    });
}


connect_to_server();




var session_key = "test_session_kumaresh";
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
// var recordButton = document.getElementById("recordButton");
// var stopButton = document.getElementById("stopButton");

//add events to those 2 buttons
var transcripts = [
"Police were called to the scene, according to the weekend reports.",
"There was a tremendous amount of anger and frustration in that music.",
"It would still have been a good film, but very different.",
"That review will look at management across the sector as a whole.",
"Naturally, it was not difficult to find support for these proposals.",
"Since backboned animals are best known to most readers, they may be taken as an illustration.",
"The rainbow is a division of white light into many beautiful colors.",
"Out beyond ideas of wrongdoing and rightdoing there is a field, I'll meet you there.",
"He also has property interests in the country.",
"I feel sorry for anyone coming in here."
]

var total_examples = 10;

var all_blobs = [];

for(var row = 0; row < total_examples; row ++){
    all_blobs.push(null);
    var recording_table_html = "<tr><td>" + (row + 1) + "</td><td style='width:500px;'>"+ transcripts[row] +"</td><td><button id='recordButton_" + row + "'>Record</button></td>"
    recording_table_html += "<td><button id='stopButton_" + row + "'>Stop</button></td><td id ='recordingholder_" + row + "' ></td></tr>"
    $("#user_recordings").append(recording_table_html)  
}


var recordButtons = [];
for(var record_button_no = 0; record_button_no < total_examples; record_button_no ++){
    recordButtons.push( document.getElementById("recordButton_" + record_button_no) );
    recordButtons[record_button_no].addEventListener("click", function() {
        startRecording(this.id);
    }); 
}


var stopButtons = [];
for(var stop_button_no = 0; stop_button_no < total_examples; stop_button_no++){
    stopButtons.push( document.getElementById("stopButton_" + stop_button_no) );
    stopButtons[stop_button_no].addEventListener("click", function() {
        stopRecording(this.id);
    });
}


$("#uploadButton").click(function(){
    upload();
});

$("#finetuneButton").click(function(){
    fine_tune_model();
});

$("#tts_button").click(function(){

    if($("#input_text").val().length == 0){
        alert("Enter some text");
        return;
    }
    get_audio_from_text($("#input_text").val());
});


$("#styleTransferButtonZeroshot").click(function(){
    get_style_transfer_results("zeroshot");
});


$("#styleTransferButtonFinetuning").click(function(){
    get_style_transfer_results("adaption");
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
    for(var sbi = 0; sbi < total_examples; sbi ++){
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



function get_style_transfer_results(cloning_type){
    console.log("Style transfer results, sending request", cloning_type);
    if(cloning_type == "zeroshot"){
        $("#styleTransferButtonZeroshot").html("Loading Style Transfer Results..");
        $("#styleTransferButtonZeroshot").prop('disabled', true);    
    }
    else if(cloning_type == "adaption"){
        $("#styleTransferButtonFinetuning").html("Loading Style Transfer Results..");
        $("#styleTransferButtonFinetuning").prop('disabled', true);    
    }
    
    $.ajax({
      url: api_address + '/get_style_transfer_results',
      data: {
        'session_key' : session_key,
        'cloning_type' : cloning_type
      },
      dataType: 'json',
      success: function(data) {
        console.log(data);
        var all_tr_rows = "";

        if(cloning_type == "zeroshot"){
            for(var idx = 0; idx < data.length; idx ++){
                style_audio_html = '<audio style="width:250px;" controls src="data:audio/ogg;base64,' + data[idx]['style_audio'] + '"></audio>';
                synthesized_audio_html = '<audio style="width:250px;" controls src="data:audio/ogg;base64,' + data[idx]['synthesized_audio'] + '"></audio>';
                tr_row = "<tr><td>" + data[idx]["ref_type"] + "</td>";
                tr_row += "<td>" + style_audio_html + "</td>";
                tr_row += "<td>" + synthesized_audio_html + "</td>";
                tr_row += "<td id='adaption_synthesized_" + idx + "'></td>";
                tr_row += "</tr>";
                all_tr_rows += tr_row;
            }
            $("#style_transfer_table").html(all_tr_rows);
            zeroshot_style_results_flag = true;
        }
        else if(cloning_type == "adaption"){
            if(zeroshot_style_results_flag == true){
                for(var idx = 0; idx < data.length; idx ++){
                    synthesized_audio_html = '<audio style="width:250px;" controls src="data:audio/ogg;base64,' + data[idx]['synthesized_audio'] + '"></audio>';
                    $("#adaption_synthesized_" + idx).html(synthesized_audio_html)
                }    
            }
            else{
                console.log("Load zeroshot style cloning results first.")
            }
        }
        
        console.log("Success");
        if(cloning_type == "zeroshot"){
            $("#styleTransferButtonZeroshot").html("Style Transfer - Zeroshot");
            $("#styleTransferButtonZeroshot").prop('disabled', false);    
        }
        else if(cloning_type == "adaption"){
            $("#styleTransferButtonFinetuning").html("Style Transfer - Finetuning");
            $("#styleTransferButtonFinetuning").prop('disabled', false);    
        }
        
      },
      error: function(err) {
        console.log(err);
        alert("Something went wrong!");
        if(cloning_type == "zeroshot"){
            $("#styleTransferButtonZeroshot").html("Style Transfer - Zeroshot");
            $("#styleTransferButtonZeroshot").prop('disabled', false);    
        }
        else if(cloning_type == "adaption"){
            $("#styleTransferButtonFinetuning").html("Style Transfer - Finetuning");
            $("#styleTransferButtonFinetuning").prop('disabled', false);    
        }
      },
      type: 'GET'
    });
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


function fine_tune_model(){
    $("#finetuneButton").html("Fine tuning model...")
    $("#finetuneButton").prop("disabled", true);
    $.ajax({
      url: api_address + '/fine_tune_model',
      data: {
        'session_key' : session_key
      },
      success: function(data) {
        console.log(data);
        console.log("Success");
        finetuneinterval = window.setInterval(function(){
          get_fine_tuning_status();
        }, 5000);
      },
      error: function(err) {
        console.log(err);
      },
      type: 'GET'
    });
}


function get_fine_tuning_status(){
    $.ajax({
      url: api_address + '/get_fine_tuning_status',
      data: {
        'session_key' : session_key
      },
      dataType: 'json',
      success: function(data) {
        console.log(data);
        var percent_complete = parseInt(data['iters_complete']/100.0 * 100);
        percent_complete = Math.min(percent_complete, 100);
        $("#finetune_bar").css('width', percent_complete+'%')
        $("#finetune_bar").attr('aria-valuenow', percent_complete);
        $("#finetune_bar").html(percent_complete + "%");

        if (data['training_complete'] == true){
            clearInterval(finetuneinterval);
            console.log("Fine Tuning Complete");
            alert("Finetuning Complete!");
            $("#finetuneButton").prop("disabled", false);
            $("#finetuneButton").html("Fine Tune Model");
        }
        console.log("Success");
      },
      error: function(err) {
        console.log(err);
      },
      type: 'GET'
    });
}


function upload(){
    $("#uploadButton").html("Uploading...");
    $("#uploadButton").prop("disabled", true);
    for(var rn = 0; rn < total_examples; rn++){
        if(all_blobs[rn] == null){
            alert("Please record all transcripts and then press upload!")
            return;
        }
    }
    var xhr=new XMLHttpRequest();
    xhr.onload=function(e) {
    if(this.readyState === 4) {
        console.log("Server returned: ",e.target.responseText);
        alert("Speaker Profile Created! You may now try out ZeroShot Style Transfer and text to speech. You may also finetune the model to get better results.")
        // fine_tune_model();
        $("#uploadButton").html("Upload");
        $("#uploadButton").prop("disabled", false);
    }
    };
    var fd=new FormData();
    fd.append("total_wavs", total_examples);
    fd.append("session_key", session_key);

    for(var rn = 0; rn < total_examples; rn++){
        var audio_key = "audio_data_" + rn;
        var transcript_key = "transcript_" + rn;
        fd.append(audio_key, all_blobs[rn], "filename.wav");    
        fd.append(transcript_key, transcripts[rn]); 

    }
    
    xhr.open("POST", api_address + "/submit_recordings",true);
    xhr.send(fd);
 }





