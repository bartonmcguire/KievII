/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

function Pitchshift(fftFrameSize, sampleRate) {
  if( arguments.length ) { this.getready(fftFrameSize, sampleRate); }
}

Pitchshift.prototype.getready = function (fftFrameSize, sampleRate) {
    this.fftFrameSize_ = fftFrameSize;
    this.sampleRate_= sampleRate;
    this.hannWindow_ = []
    this.gRover_ = 0;

    /* TODO subscript them!
     * TODO they must be 0! */
    this.gInFIFO = [];
    this.gOutFIFO = [];
    this.gLastPhase = [];
    this.gSumPhase = [];
    this.gOutputAccum = [];
    this.gAnaFreq = [];
    this.gAnaMagn = [];
    this.gSynFreq = [];
    this.gSynMagn = [];
    // Only the signal, multiplied for the window. (TODO dsp.js has windowing funcs).
    this.gFFTworksp = [];
    // Real and imaginary parts of the resynthesized signal
    this.real_ = [];
    this.imag_ = [];

    for (k = 0; k < fftFrameSize; k++) {
        //Pre-generating Hann wavetable
        this.hanWindow_[k]= WindowFunction.Hann(fftFrameSize, k);
    }
};

Pitchshift.prototype.getready = function (pitchShift, numSampsToProcess, osamp, indata) {

	var fftFrameSize2 = this.fftFrameSize_/2;
	var stepSize = this.fftFrameSize_/osamp;
	var freqPerBin = this.sampleRate_ / this.fftFrameSize_;
	var expct = 2.* Math.PI * stepSize / this.fftFrameSize_
	var inFifoLatency = this.fftFrameSize_ - stepSize;
	if (this.gRover_ == 0) this.gRover_ = inFifoLatency;

        var outdata = [];

        /* main processing loop */
	for (i = 0; i < numSampsToProcess; i++){
            /* As long as we have not yet collected enough data just read in */
		this.gInFIFO[this.gRover_] = indata[i];
		outdata[i] = this.gOutFIFO[this.gRover_ - inFifoLatency];
		this.gRover_++;

		/* now we have enough data for processing */
		if (this.gRover_ >= this.fftFrameSize_) {
			this.gRover_ = inFifoLatency;

			/* Do the windowing */
			for (k = 0 ; k < this.fftFrameSize_ ; k++) {
                            //Need the signal for the FFT.
                            this.gFFTworksp[k] = this.gInFIFO[k] * this.hanWindow_[k];
                            //this.gFFTworksp[k][1] = 0.;
                        }

                        /*
                        Do the forward dft here.
			p = fftw_plan_dft_1d(fftFrameSize, gFFTworksp, gFFTworksp, FFTW_FORWARD, FFTW_MEASURE);
			q = fftw_plan_dft_1d(fftFrameSize, gFFTworksp, gFFTworksp, FFTW_BACKWARD, FFTW_MEASURE);
			fftw_execute(p);
                        */

                       //FFT(bufferSize, sampleRate): Fast Fourier Transform

                       var fft = new FFT(this.fftFrameSize_, this.sampleRate_);
                       fft.forward(this.gFFTworksp);
                       //this.gFFTworksp = fft.spectrum;


                       /* this is the analysis step */
                       for (k = 0; k <= fftFrameSize2; k++) {

                                //Mmmmh. Taking some "private" member out of fft here.
                                var magn = 2 * Math.sqrt (fft.real[k] * fft.real[k] + fft.imag[k] * fft.imag[k]);
                                var phase = Math.atan2 (fft.imag[k], fft.real[k]);

				/* compute phase difference */
				var tmp = phase - this.gLastPhase[k];
				this.gLastPhase[k] = phase;

				/* subtract expected phase difference */
				tmp -= k * expct;

				/* map delta phase into +/- Pi interval */
				var qpd = tmp / Math.PI;
				if (qpd >= 0) {
                                    qpd += qpd & 1;
                                }
				else {
                                    qpd -= qpd & 1;
                                }
				
                                tmp -= Math.PI * qpd;

				/* get deviation from bin frequency from the +/- Pi interval */
				tmp = osamp * tmp /(2 * Math.PI);

				/* compute the k-th partials' true frequency */
				tmp =  k * freqPerBin + tmp * freqPerBin;

				/* store magnitude and true frequency in analysis arrays */
				this.gAnaMagn[k] = magn;
				this.gAnaFreq[k] = tmp;

			}
                        
                        /* ***************** PROCESSING ******************* */
			/* this does the actual pitch shifting */
			
			for (k = 0; k <= fftFrameSize2; k++) {

				var index = k / pitchShift;
				
				if (index <= fftFrameSize2) {
                                    	this.gSynMagn[k] += this.gAnaMagn[index];
					this.gSynFreq[k] = this.gAnaFreq[index] * pitchShift;
                                    }
                            }

                        /* ***************** SYNTHESIS ******************* */
			/* this is the synthesis step */
			for (k = 0; k <= fftFrameSize2; k++) {

				/* get magnitude and true frequency from synthesis arrays */
				magn = this.gSynMagn[k];
				tmp = this.gSynFreq[k];

				/* subtract bin mid frequency */
				tmp -= k * freqPerBin;

				/* get bin deviation from freq deviation */
				tmp /= freqPerBin;

				/* take osamp into account */
				tmp = 2.* Math.PI * tmp / osamp;

				/* add the overlap phase advance back in */
				tmp += k * expct;

				/* accumulate delta phase to get bin phase */
				this.gSumPhase[k] += tmp;
				phase = this.gSumPhase[k];

				// Get real and imag part
				this.real_[k] = magn*cos(phase);
				this.imag_[k] = magn*sin(phase);
			}

                        // zero negative frequencies
			for (k = ((fftFrameSize2)+1); (k < this.fftFrameSize_); k++) {

                            this.real_[k] = 0;
			    this.imag_[k] = 0;

                        }

			// Do the Inverse transform
                       var signal = fft.inverse(this.real_, this.imag_);

			// Do windowing and add to output accumulator
			for(k=0; k < this.fftFrameSize_; k++) {

				this.gOutputAccum[k] += this.han_window_[k] * signal[k];

			}

                        for (k = 0; k < stepSize; k++) this.gOutFIFO[k] = this.gOutputAccum[k];

			/* shift accumulator TODO
			memmove(gOutputAccum, gOutputAccum+stepSize, fftFrameSize*sizeof(float)); */

			/* move input FIFO */
			for (k = 0; k < inFifoLatency; k++) {
                            this.gInFIFO[k] = this.gInFIFO[k + stepSize];
                        }
                    }
                }
            }
