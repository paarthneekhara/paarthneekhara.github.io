
 //webkitURL is deprecated but nevertheless
URL = window.URL || window.webkitURL;

var api_address = "https://b04a-138-68-131-51.ngrok.io";
var session_key = "test_session";
var _testing = false;



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
var transcripts = [
"",
]

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

var total_examples = 1;

var all_blobs = [];

var target_speakers = [
    {'obama': 'Obama'},
    {'modi' : 'Modi'},
    {'ravish' : 'Ravish'},
    {'priyanka' : 'Priyanka'},
    {'lex' : 'Lex'},
    {'oprah': 'Oprah'},
    {'emma': 'Emma'},
    {'miley' : 'Miley'},
    {'aubrey' : 'Aubrey'},
    {'sundar' : 'Sundar'},
    {'ahmadCorrect' : 'Ahmad (Correct)'},
    {'custom': 'Custom (Select Audio File)'},
]


for(var row = 0; row < total_examples; row ++){
    all_blobs.push(null);
    var inputTypeSlectTd = "<td><select class='inputTypeSelector' id='inputTypeSelect_" + row + "'>";
    inputTypeSlectTd += "<option value='recording'>Recording</option><option value='file'>Select audio file</option></select></td>"
    var speakerSelectTd = "<td><select class='speakerSelector' id='speakerSelect_" + row + "'>";
    var convertedAudioTd = "<td id='convertedAudioTd_" + row + "'></td>"
    var fileSelectTd = "<td style='display:None' class='targetCustomAudio' id='targetFileSelectTd_" + row + "'> <input type='file' id='targetFileSelect_" + row + "' accept='audio/*' /></td>"
    var selectedFileTd = "<td style='display:None' class='targetCustomAudio' id='selectedTargetFileTd_" + row + "'></td>"
    var sourceFileSelectTd = "<td style='display:None' class='sourceSelectControl' id='sourceFileSelectTd_" + row + "'> <input type='file' id='sourceFileSelect_" + row + "' accept='audio/*' /></td>"
    var selectedSourceFileTd = "<td style='display:None' class='sourceSelectControl' id='selectedSourceFileTd_" + row + "'></td>"
    for(var spkid=0; spkid < target_speakers.length; spkid++){
        speakerSelectTd += "<option value='" + Object.keys(target_speakers[spkid])[0] + "'>" + Object.values(target_speakers[spkid])[0] + "</option>"
    }
    speakerSelectTd += "</select></td>"
    var recording_table_html = "<tr>" + inputTypeSlectTd + "<td class='recordingControls' ><button id='recordButton_" + row + "'>Record</button></td>";
    recording_table_html += "<td class='recordingControls' ><button id='stopButton_" + row + "'>Stop</button></td><td class='recordingControls' id ='recordingholder_" + row + "' ></td>" + sourceFileSelectTd + selectedSourceFileTd + speakerSelectTd  + fileSelectTd + selectedFileTd + convertedAudioTd + "</tr>";
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


function makeUploadButtonActive(){
    $("#uploadButton").html("Convert Voice");
    $("#uploadButton").prop("disabled", false);
}

function upload(){

    // for(var rn = 0; rn < total_examples; rn++){
        
    // }

    $("#uploadButton").html("Converting...");
    $("#uploadButton").prop("disabled", true);

    var xhr=new XMLHttpRequest();
    xhr.onload=function(e) {
        if(this.readyState === 4) {
            fine_tune_global_flag = false;
            fine_tune_triggered = false;
            if(this.status === 200) {
                response_data = JSON.parse(e.target.responseText);
                results = response_data["results"];
                for(var rn = 0; rn < total_examples; rn++){
                    audio_html = '<audio style="width:250px;" controls src="data:audio/ogg;base64,' + results[rn]['audio_converted'] + '"></audio>'
                    $("#convertedAudioTd_" + rn).html(audio_html);
                }
            }
        }
        makeUploadButtonActive();
    };
    var fd=new FormData();
    fd.append("total_wavs", total_examples);
    fd.append("session_key", session_key);

    for(var rn = 0; rn < total_examples; rn++){
        var audio_key = "audio_data_" + rn;
        var target_speaker_audio_key = "target_speaker_audio_" + rn;
        var custom_source_audio_key = "custom_source_audio_" + rn;
        var transcript_key = "transcript_" + rn;
        var speaker_key = "speaker_" + rn;
        var speaker_val = $("#speakerSelect_" + rn).val();
        
        var input_type = $("#inputTypeSelect_" + rn).val();
        var input_type_key = "input_type_" + rn;
        
        if(speaker_val == "custom"){
            targetFileSelected = $("#targetFileSelect_" + rn)[0].files[0];
            if(targetFileSelected == null){
                alert("Please select a target audio file for the custom speaker");
                makeUploadButtonActive();
                return;
            }
            fd.append(target_speaker_audio_key, $("#targetFileSelect_" + rn)[0].files[0]);
        }
        if(input_type == "recording"){
            if(all_blobs[rn] == null){
                alert("Please record all transcripts and then press upload!")
                makeUploadButtonActive();
                return;
            }
            fd.append(audio_key, all_blobs[rn], "filename.wav");    
        }
        else{
            var sourceFileSelected = $("#sourceFileSelect_" + rn)[0].files[0];
            if(sourceFileSelected == null){
                alert("Please select a source audio file for the custom speaker");
                makeUploadButtonActive();
                return;
            }
            fd.append(custom_source_audio_key, $("#sourceFileSelect_" + rn)[0].files[0]);
        }
        
        fd.append(transcript_key, transcripts[rn]); 
        fd.append(speaker_key, speaker_val);
        fd.append(input_type_key, input_type);

    }
    
    xhr.open("POST", api_address + "/convert_recordings",true);
    xhr.send(fd);
 }


$('.speakerSelector').change(function(){
    var speaker_val = $(this).val();
    if (speaker_val == "custom"){
        $('.targetCustomAudio').show();
    }
    else{
        $('.targetCustomAudio').hide();
    }
}); 

$('.inputTypeSelector').change(function(){
    var input_type_val = $(this).val();
    if (input_type_val == "recording"){
        $('.recordingControls').show();
        $('.sourceSelectControl').hide();
    }
    else{
        $('.recordingControls').hide();
        $('.sourceSelectControl').show();
    }
});

$("#targetFileSelect_0").change(function(){
    var targetFileSelected = $("#targetFileSelect_0")[0].files[0];
    if(targetFileSelected != null){
        // insert audio element in the table
        var audio_html = '<audio style="width:250px;" controls src="' + URL.createObjectURL(targetFileSelected) + '"></audio>'
        $("#selectedTargetFileTd_0").html(audio_html);
    }
});

$("#sourceFileSelect_0").change(function(){
    var sourceFileSelected = $("#sourceFileSelect_0")[0].files[0];
    if(sourceFileSelected != null){
        // insert audio element in the table
        var audio_html = '<audio style="width:250px;" controls src="' + URL.createObjectURL(sourceFileSelected) + '"></audio>'
        $("#selectedSourceFileTd_0").html(audio_html);
    }
});
// document.getElementById("style_reference_user").addEventListener("change", custom_style_input);



