var thermostat = {
	ports: ['buttons[2]', 'temperature[2]', 'digits[3][7]'],
	components: {
		my_nand2: {
			ports: ['a', 'b', 'y'],
			rectangles: [
				{ port: 'a', layer: 'li1', x: 0.123, y: 0.343, width: 3.345, height: 234.2, angle: 0 },
			],
		},
		alu: {
			ports: ['a[16]', 'b[16]', 'y[16]', 'z', 'n'],
			components: {
				alu_multiplier_16: 'https://raw.githubusercontent.com/arjunrajasekharan/16-bit-DADDA-Multiplier/main/dadda.v',
				alu_xor_4: 'https://raw.githubusercontent.com/google/skywater-pdk-libs-sky130_fd_sc_ls/4f549e30dd91a1c264f8895e07b2872fe410a8c2/cells/xor2/sky130_fd_sc_ls__xor2_4.v',
			},
			connections: [
				['ports.a', 'alu_multiplier.a', 'alu_xor.a'],
			],
		},
	},
	connections: [
		['ports.buttons[0]', 'alu.multiplier.x[0]'],
	],
}
