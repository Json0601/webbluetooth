const { Bluetooth } = require("../dist");

const devices: BluetoothDevice[] = [];
const characteristics: BluetoothRemoteGATTCharacteristic[] = [];

const bluetooth = new Bluetooth({ scanTime: 300, deviceFound: (device: BluetoothDevice, _selectFn) => {
	devices.push(device);
	connect(device);
	return false;
} });

bluetooth.requestDevice({
	filters: [
		{ namePrefix: "exoPill" },
	]
});

const enumerateGatt = async server => {
	const services = await server.getPrimaryServices();
	const sPromises = services.map(async service => {
			const characteristics = await service.getCharacteristics();
			const cPromises = characteristics.map(async characteristic => {
					let descriptors = await characteristic.getDescriptors();
					descriptors = descriptors.map(descriptor => `\t\t└descriptor: ${descriptor.uuid}`);
					descriptors.unshift(`\t└characteristic: ${characteristic.uuid}`);
					return descriptors.join("\n");
			});

			const descriptors = await Promise.all(cPromises);
			descriptors.unshift(`service: ${service.uuid}`);
			return descriptors.join("\n");
	});

	const result = await Promise.all(sPromises);
	console.log(result.join("\n"));
};

async function connect(device: BluetoothDevice) {
	try {
		device.ongattserverdisconnected = (event) => {
			const d = event.target! as BluetoothDevice;
			if(!d.gatt?.connected) {
				console.log(`${d.name} disconnected`);
			}
		}
		const server = await device.gatt?.connect();
		await enumerateGatt(server);
		const service = await server?.getPrimaryService(0x00ff);
		const characteristic = await service?.getCharacteristic(0xff01);
		characteristics.push(characteristic!);
		if(characteristic) {
			console.log(`${device.name} connected`);
			await characteristic.startNotifications();
			if(device.name?.startsWith("exoMini")) {
				await characteristic.writeValue(new Uint8Array(["T".charCodeAt(0), "A".charCodeAt(0)]));
			}
			characteristic.oncharacteristicvaluechanged = (e) => {
				const buffer = (e.target as BluetoothRemoteGATTCharacteristic).value?.buffer;
				if(buffer) {
					const value = Array.from(new Uint8Array(buffer));
					console.log(`${device.name} N [${value.map((v) => "0x" + v.toString(16).padStart(2, "0")).join(", ")}]`);
				}
			}
		}
	}
	catch(e) {
		console.log(e);
	}
}

(async () => {
	await keypress();
	devices.forEach((v) => v.gatt?.disconnect())
	await keypress();
	characteristics.forEach((v) => v.writeValue(new Uint8Array([0x74])))
	await keypress();
})().then(() => process.exit());

async function keypress() {
	// process.stdin.setRawMode(true);
	return new Promise<void>((resolve) => {
		process.stdin.once("data", () => {
			// process.stdin.setRawMode(false);
			resolve();
		})
	})
}