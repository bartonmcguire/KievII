var VORON = {};

/* AUDIO INIT FUNCTION */
VORON.audioInit = function() {

    // TODO is it right to initialize this here?
    this.audioOk = false;

    // AUDIO SOURCE INIT
    this.audio = document.getElementById("a1");
    try {
        this.source = new AudioDataSource(this.audio);
    }
    catch (err) {
        console.log ("Catched an exception: ", err, " Audio could be not loaded: ", err.description);
        return;
    }
    this.shifterParams = {};
    this.outputDestination = new AudioDataDestination();

    //Set auto latency.
    this.outputDestination.autoLatency = true;

    //The original signal must not be played back.
    this.audio.volume = 0;

    // END OF AUDIO SOURCE INIT

    // PITCH SHIFTER INIT

    this.shifterParams.fftFrameSize = 2048;
    this.shifterParams.shiftAmount = 1.0;
    this.shifterParams.osamp = 4;
    this.shifterParams.algo = "RFFT";
    this.filter_shifter = new AudioDataShifterFilter (this.outputDestination, this.shifterParams);
    //source.readAsync(this.filter_shifter);

    // END OF PITCH SHIFTER INIT

    // LOWPASS FILTER INIT

    this.filter_lowpass = new ADLowPassFilter(this.filter_shifter, 2000, 10, 44100);

    // END OF LOWPASS FILTER INIT

    // VOLUME FILTER INIT

    this.filter_volume = new ADSimpleVolume (this.filter_lowpass, 0.5);

    // END OF VOLUME FILTER INIT

    this.audioOk = true;

    // This sets the chain end.
    this.source.readAsync(this.filter_volume);

}

/* END OF AUDIO INIT FUNCTION */

/* KEEP ON */

VORON.keepON = function () {

    this.audioInit();

    // Here we add the elements to the UI, optionally add
    // connections between them and set the initial values.

    this.ui.addElement(this.gui, this.imageDisplayer);
    this.ui.addElement(this.pitchKnob, this.pitchKnobImageDisplayer);
    this.ui.addElement(this.freqKnob, this.freqKnobImageDisplayer);
    this.ui.addElement(this.qKnob, this.qKnobImageDisplayer);
    this.ui.addElement(this.volSlider, this.volImageDisplayer);
    this.ui.addElement(this.pitchOnSwitch, this.switchImageDisplayer);
    this.ui.addElement(this.pitchDiscSwitch, this.switchImageDisplayer);
    this.ui.addElement(this.freqSwitch, this.switchImageDisplayer);
    this.ui.addElement(this.invertSwitch, this.switchImageDisplayer);

    // TODO Something like ui.refresh() would be more appropriate, I guess.
    this.gui.refresh();

    // TODO if drawClass is undefined, just exit. This should be in the
    // initialize section, not here. keepON should do a ui.refresh() to
    // repaint everything (in order).
    this.pitchKnob.setValue("knobvalue", 0.5);
    this.freqKnob.setValue("knobvalue", 1);
    // TODO qKnob.setValue("knobvalue", 0) fails (does not display image)
    // because the initial value is 0 (why?). with ui.refresh() this does
    // not happen.
    // Quick-fixed setting default knob value to NaN.
    this.qKnob.setValue("knobvalue", 0);
    this.volSlider.setValue("slidervalue", 0.5);
    // These buttons have 0 = on and 1 = off.
    // TODO set NaN or null as the default value also in Button class.
    this.pitchOnSwitch.setValue ("buttonvalue", 0);
    this.pitchDiscSwitch.setValue ("buttonvalue", 0);
    this.freqSwitch.setValue ("buttonvalue", 0);
    this.invertSwitch.setValue ("buttonvalue", 0);

}

/* --END */

/*** CALLBACKS ***/

/* LOADING MANAGER */

VORON.loadingManager = function (elementName) {
    // Closure persistent variables.
    var that = this,
        loadStatus = {
            pitchKnob: false, freqKnob: false, qKnob: false,
            background: false, volSlider: false,
            pitchOnSwitch: false, pitchDiscSwitch : false,
            freqSwitch: false, invertSwitch: false
        };

        // Actual callback
        return function (elementName) {
            console.log (elementName, " called back to say everything is loaded.");

            // Update the element status
            if (loadStatus[elementName] !== undefined) {
                loadStatus[elementName] = true;
            }

            // Check if every registered element is complete.
            for (var element in loadStatus) {
                if (loadStatus.hasOwnProperty(element)) {
                    if (loadStatus[element] !== true) {
                        console.log ("status of element ", element, " is not true: ", loadStatus[element]);
                        return;
                    }
                }
            }
            console.log ("Everything loaded, time to keep on!");
            that.keepON();
        }

}
/* END OF LOADING MANAGER */

/* ELEMENT CALLBACKS */

VORON.pitchCallback = function () {
    var that = this;
    return function (slot, value) {
        if (that.audioOk === true) {
            // TODO: this interpolation should really not be linear.
            // LINEAR INTERPOLATION: x := (c - a) * (z - y) / (b - a) + y
            // c = value; a = 0; b = 1; y = 0.5; z = 2
            var shift_value = value * (1.5) + 0.5;
            that.filter_shifter.setShift(shift_value);
            console.log ("pitch callback finished: slot is ", slot, " and value is ", value, " while shifting ratio is ", shift_value);
        }

        else {
            console.log ("No moz-audio, just skipping");
        }
    };
}

VORON.freqCallback = function () {
    var that = this;
    return function (slot, value) {
        if (that.audioOk === true) {
            // LINEAR INTERPOLATION: x := (c - a) * (z - y) / (b - a) + y
            // c = value; a = 0; b = 1; y = 20; z = 2000
            var cutoff_value = value  * (2000 - 20) + 20;
            that.filter_lowpass.setCutoff(cutoff_value);
            console.log ("freq callback finished: slot is ", slot, " and value is ", value, " while cutoff is ", cutoff_value);
        }

        else {
            console.log ("No moz-audio, just skipping");
        }
    };
}

VORON.qCallback = function () {
    var that = this;
    return function (slot, value) {

        if (that.audioOk === true) {
            // LINEAR INTERPOLATION: x := (c - a) * (z - y) / (b - a) + y
            // c = value; a = 0; b = 1; y = 1; z = 50
            var q_value = value  * (50 - 1) + 1;
            that.filter_lowpass.setResonance(q_value);
            console.log ("q callback finished: slot is ", slot, " and value is ", value, " while res is ", q_value);
        }

        else {
            console.log ("No moz-audio, just skipping");
        }

    };
}

VORON.volCallback =function () {
    var that = this;
    return function (slot, value) {

        if (that.audioOk === true) {
            that.filter_volume.setVolume (value);
            console.log ("vol callback finished: slot is ", slot, " and value is ", value);
        }

        else {
            console.log ("No moz-audio, just skipping");
        }

    };
}

VORON.switchCallback = function () {
    var that = this;
    return function (slot, value, elName) {

        if (that.audioOk === true) {

            console.log ("switch callback called: element is ", elName, " slot is ", slot, " and value is ", value, " while that is ", that);
            switch (elName) {
                case "pitchOnSwitch":
                    if (value === 1) {
                        that.filter_shifter.setOnOff(false);
                        console.log ("Setting pitch off: ", value);
                        break;
                    }
                    if (value === 0) {
                        that.filter_shifter.setOnOff(true);
                        console.log ("Setting pitch on: ", value);
                        break;
                    }
                    console.log ("pitchswitch has a strange value: ", value);
                break;

                case "freqSwitch":
                    if (value === 1) {
                        that.filter_lowpass.setOnOff(false);
                        console.log ("Setting freq off: ", value);
                        break;
                    }
                    if (value === 0) {
                        that.filter_lowpass.setOnOff(true);
                        console.log ("Setting freq on: ", value);
                        break;
                    }
                    console.log ("pitchswitch has a strange value: ", value);
                break;

                default:
                //nothing to be done
            }
        }

        else {
            console.log ("No moz-audio, just skipping");
        }

    };
}

/* END OF ELEMENT CALLBACKS */

VORON.init = function () {

    /* HOISTED VARs */

    var MAX_KNOB_IMAGE_NUM = 60,
        i = 0,
        prefix,
        knobImgLocation = "./images/BigKnob/",
        knobImgArray = [],
        knobArgs,
        bgArgs,
        volSliderArgs,
        switchArgs,
        pitchArgs,
        freqArgs,
        qArgs,
        switchCallbackManager;

    /* END OF HOISTED VARs */

    /* CONTEXT INIT */
    this.plugin_canvas = document.getElementById("plugin"),
    this.plugin_context = this.plugin_canvas.getContext("2d");

    this.ui = new UI (this.plugin_canvas);

    this.imageDisplayer = new CanvasDrawImage (this.plugin_context);
    this.freqKnobImageDisplayer = new CanvasDrawImage (this.plugin_context);
    this.qKnobImageDisplayer = new CanvasDrawImage (this.plugin_context);
    this.pitchKnobImageDisplayer = new CanvasDrawImage (this.plugin_context);
    this.volImageDisplayer = new CanvasDrawImage (this.plugin_context);
    this.switchImageDisplayer = new CanvasDrawImage (this.plugin_context);

    this.loadCallback = this.loadingManager();
    /* END OF CONTEXT INIT */

    /* BACKGROUND INIT */

    bgArgs = {
        image: "./images/Voron_bg1.png",
        onComplete: this.loadCallback
    };

    this.gui = new Background("background", [0,0], bgArgs);

    /* END OF BACKGROUND INIT */

    /* KNOB INIT */

    // Generate knob image names
    // Todo use an immediate funtion.

    for (i = 0; i <= MAX_KNOB_IMAGE_NUM; i++) {
        prefix = "";
        if (i < 10) {
            prefix = "0";
        }
        knobImgArray[i] = knobImgLocation + "BigKnob" + prefix + i + ".png";
    }

    // Shared arguments to the Knob constructor.
    knobArgs = {
        images : knobImgArray,
        sensivity : 5000,
        onComplete: this.loadCallback,
        preserveBg: true
    };

    // Create the knob objects.

    // PITCH KNOB
    pitchArgs = knobArgs.clone();
    pitchArgs.onValueSet = this.pitchCallback();
    this.pitchKnob = new Knob("pitchKnob", [67, 150], pitchArgs);

    // FREQ KNOB
    freqArgs = knobArgs.clone();
    freqArgs.onValueSet = this.freqCallback();
    this.freqKnob = new Knob("freqKnob", [268, 150], freqArgs);

    // Q KNOB
    qArgs = knobArgs.clone();
    qArgs.onValueSet = this.qCallback();
    this.qKnob = new Knob("qKnob", [421, 150], qArgs);

    /* END OF KNOB INIT */

    /* FADER INIT */

    //VOL FADER
    volSliderArgs = {
        sliderImg:"./images/Fader/slider_slot.png", knobImg:"./images/Fader/slider_handle.png",
        type:"vertical",
        onComplete: this.loadCallback
    };

    volSliderArgs.onValueSet = this.volCallback();
    this.volSlider = new Slider("volSlider", [646, 136], volSliderArgs);

    /* END OF FADER INIT */

    /* SWITCHES INIT */

    // This time, we use an single callback for all switch buttons.
    switchCallbackManager = this.switchCallback();

    // Shared arguments to the Button constructor.
    switchArgs = {
        images : ["./images/Switch/SwitchLeft.png","./images/Switch/SwitchRight.png"],
        onComplete: this.loadCallback,
        onValueSet: switchCallbackManager
    };

    // Create the switch objects TODO the x,y values are not coherent.
    this.pitchOnSwitch = new Button("pitchOnSwitch", [89,107], switchArgs);
    this.pitchDiscSwitch = new Button("pitchDiscSwitch", [89,339], switchArgs);
    this.freqSwitch = new Button("freqSwitch", [365,107], switchArgs);
    this.invertSwitch = new Button("invertSwitch", [638,415], switchArgs);

    /* END OF SWITCHES INIT */

}