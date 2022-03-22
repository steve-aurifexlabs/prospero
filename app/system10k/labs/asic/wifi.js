var module = {
	ports: ['antenna{positive, negative}','dataIn[n]', 'dataOut[n]', 'writeEnable', 'error', 'control{in, out, clock, select}'],
	components: {
		transceiverSwitch: './rf/wifi_switch_2.412ghz_22mhz.js',
		receiverFrontend: 'https://lib.aurifexlabs.com/asic/rf/low_noise_amplifier_2.412ghz_22mhz.js',
		transmitterFrontend: 'https://lib.aurifexlabs.com/asic/rf/power_amplifier_2.412ghz_22mhz.js',
		receiverMixer: 'https://lib.aurifexlabs.com/asic/rf/mixer_down_2.412ghz_22mhz.js',
		transmitterMixer: 'https://lib.aurifexlabs.com/asic/rf/mixer_up_2.412ghz_22mhz.js',

		adc: 'https://lib.aurifexlabs.com/asic/mixed/adc_32.5Mhz_12b.js',
		dac: 'https://lib.aurifexlabs.com/asic/mixed/dac_32.5Mhz_12b.js',
		ifft: 'https://lib.aurifexlabs.com/asic/digital/ifft_64_32.5Mhz_500ns_16b.js',
		fft: 'https://lib.aurifexlabs.com/asic/digital/fft_64_32.5Mhz_500ns_16b.js',
		symbolDecoder: 'https://lib.aurifexlabs.com/asic/digital/64qam_decoder_64x_500khz.js',
		symbolEncoder: 'https://lib.aurifexlabs.com/asic/digital/64qam_encoder_64x_500khz.js',

		transceiverLogic: './wifi_tranceiver_logic.js',
		collisionStateMachine: './fsm/csma_ca.js',
		receiveStateMachine: './fsm/receive.js',
		transmitStateMachine: './fsm/transmit.js',
		receiveBuffer: 'https://lib.aurifexlabs.com/asic/digital/queue_1k_8b.js',
		transmitBuffer: 'https://lib.aurifexlabs.com/asic/digital/queue_1k_8b.js',

		controlInterface: './wifi_control.js',
		bigProcessor: 'https://lib.aurifexlabs.com/asic/cpu/aurifex_big_16b.js',
		littleProcessor: 'https://lib.aurifexlabs.com/asic/cpu/aurifex_little_16b.js',
	},
	connections: [
		['ports.antenna', 'transceiverSwitch.antenna'],
		['transceiverSwitch.out', 'receiverFrontend.in'],
		['transceiverSwitch.in', 'transmitterFrontend.out'],
		['receiverFrontend.out', 'receiverMixer.in'],
		['transmitterFrontend.in', 'transmitterMixer.out'],

		['receiverMixer.out', 'adc.in'],
		['trasmitterMixer.in', 'dac.out'],
		['adc.out', 'ifft.in'],
		['dac.in', 'fft.out'],
		['ifft.out', 'symbolDecoder.in'],
		['fft.in', 'symbolEncoder.out'],

		['symbolDecoder.out', 'transceiverLogic.symbolIn'],
		['symbolEncoder.in', 'transceiverLogic.symbolOut'],
		['collisionStateMachine.collision', 'transceiverLogic.collision'],
		['receiveStateMachine.receive', 'transceiverLogic.receive'],
		['transmitStateMachine.transmit', 'transceiverLogic.transmit'],
		['transceiverLogic.dataOut', 'receiveBuffer.dataIn'],
		['transceiverLogic.writeEnable', 'receiveBuffer.writeEnable'],
		['transceiverLogic.dataIn', 'transmitBuffer.dataOut'],

		['transceiverLogic.control', 'controlInterface.transceiverControl'],
		['controlInterface.external', 'ports.control'],
		['controlInterface.bigProcessorControl', 'bigProcessor.control'],
		['controlInterface.littleProcessorControl', 'littleProcessor.control'],
	],

	dataRates: {
		dataIn: 54e6,  // bps
		dataOut: 54e6,
	},
	wifiStandards: {
		'802.11g': {
			channels: {
				'2.4ghz_channel1': {
					centerFrequency: 2.412e9,
					bandwidth: 22e6,
				},
			},
		},
	},
	portDirections: {
		'antenna.positive': 'rf_inout',
		'antenna.negative': 'rf_inout',
		'dataIn': 'in',
		'dataOut': 'out',
		'writeEnable': 'in',
		'error': 'out',
		'control.in': 'in',
		'control.out': 'out',
		'control.clock': 'in',
		'control.select': 'in',
	},
	software: {
		bigProcessor: './c/wifi_big.c',
		littleProcessor: './c/wifi_little.c',
	},
}
