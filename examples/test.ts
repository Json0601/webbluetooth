const { Bluetooth } = require("../dist");

const devices: BluetoothDevice[] = [];

const bluetooth = new Bluetooth({ scanTime: 30, deviceFound: (device: BluetoothDevice, _selectFn) => {
	devices.push(device);
	connect(device);
	return false;
} });

bluetooth.requestDevice({
	filters: [
		{ namePrefix: "exoPill" },
		{ namePrefix: "exoMini" }
	]
});

async function connect(device: BluetoothDevice) {
	try {
		device.ongattserverdisconnected = (event) => {
			const d = event.target! as BluetoothDevice;
			if(!d.gatt?.connected) {
				console.log(`${d.name} disconnected`);
			}
		}
		const server = await device.gatt?.connect();
		const service = await server?.getPrimaryService(0x00ff);
		const characteristic = await service?.getCharacteristic(0xff01);
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