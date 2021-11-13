# ÆGIS

## See the [aegis-host](https://github.com/module-federation/MicroLib) repo for documentation and a working example of a federation server.

### Consolidate your micoservices for decreased footprint, better performance, greater workload density and simpler operations without losing deployment or language independence or tightly coupling to shared dependencies.

### Or distribute your components dynamically, integrate them transparently and update them live in producetion with runtime bindng, zero downtime, and zero software installation.

### Distribute them anywhere, outside the datacenter and beyond the edge, to phones or drones, etc.

### And do it all without deployment automation. You don't need that anymore.


![Aegis Federated Architcture](https://user-images.githubusercontent.com/38910830/141614069-20be312c-2408-4ca8-9d59-2f34f6adbd39.gif)


[![Aegis Overview](https://res.cloudinary.com/marcomontalbano/image/upload/v1632364889/video_to_markdown/images/youtube--n2qqgi3fTto-c05b58ac6eb4c4700831b2b3070cd403.jpg)](https://youtu.be/jddhfLA_2k0 "Aegis Overview")

## Using ÆGIS

### Install [<img src="https://github.com/tysonrm/cluster-rolling-restart/blob/main/npm-tile.png">](https://www.npmjs.com/package/@module-federation/aegis)
```shell
npm i @module-federation/aegis
```

### Contribute [![Open in Visual Studio Code](https://open.vscode.dev/badges/open-in-vscode.svg)](https://open.vscode.dev/module-federation/aegis)

```shell
git clone https://github.com/module-federation/aegis
cd aegis
yarn
yarn build
yarn link 

cd ..

git clone https://github.com/module-federation/microlib
cd microlib
cp dotenv.example .env
yarn
yarn link "@module-federation/aegis"
yarn build
yarn start
yarn demo
```

# Work in Progress

## WebAssembly
Enable polyglot, WASM-powered compute 

### Overview:
- Support WASM modules as domain, adapter, and service components
- Linter and compiler transform supports compiling existing TypeScript to AssemblyScript
- Support in browser and on any WASM runtime (No Node.js dependency)

## AppMesh 
Decentralized network for transparent integration and dynamic redistribution of federated software

### Overview:
- Distributed object cache over switched mesh network 
- Gracefully degrade or upgrade based on available middleware (plug-in NATs, Kafka, etc).
- No assumption of container networking or provisioning automation, compute delivery nethod abstracted
- Operations analytics / AIOps capture performance at switch nodes, recommends deployment changes)
- Operations automation (implement recommended changes, including basic orchestration)
- Dynamic redeployment (e.g. of 2 chatty services to same instance, run closer to users and data)
- Use Cases: DataMesh, Federated Learning, transparent integration, low-config, 

### Based on:
- Web3 / blockchain / Solid
- Software defined overlay network
