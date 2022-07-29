## Requirements

Have Node.js and npm installed and working

## Setup

### Installation

1. Install the dependencies with `npm install` or `npm ci` (install exact dependencies as defined by `package-lock.json` file)
2. Create and fill an `.env` file in the root of the project (see [reference below](#.env-file-fields) for the keys)
3. Create and fill an `config.js` file in the root of the project
4. Start the server with `node index.js` or using a process manager like [PM2](http://pm2.keymetrics.io/) for example
5. (Optional) Compile the trajectory format converters with `npm run build`. Otherwise, the trajectory endpoint will not be able to export from .bin to other formats. [Chemfiles](#chemfiles-installation) must be previously installed.

### `.env` file fields

⚠️ No sensible default value is provided for any of these fields, they **need to be defined** ⚠️

| key              | value                         | description               |
| ---------------- | ----------------------------- | ------------------------- |
| NODE_ENV         | `development` or `production` | dev or prod flag          |
| DB_SERVER        | `<url>`                       | url of the db server      |
| DB_PORT          | number                        | port of the db server     |
| DB_NAME          | string                        | name of the db collection |
| DB_AUTH_USER     | string                        | db user                   |
| DB_AUTH_PASSWORD | string                        | db password               |
| DB_AUTHSOURCE    | string                        | authentication db         |

### config.js file template

module.exports = {
"hosts": {
"mdposit.bsc.es": {
"name": "MDposit",
"description": "The main server including all simulations",
"prefix": "MDP",
"collection": null
},
"bioexcel-cv19.bsc.es": {
"name": "BioExcel-CV19",
"description": "The Covid-19 server",
"prefix": "MCV19",
"collection": "cv19"
},
}
}

### chemfiles installation

Clone and install the [chemfiles fork](https://github.com/d-beltran/chemfiles) customized to support '.bin' format reading and streaming.

```bash
git clone https://github.com/d-beltran/chemfiles
cd chemfiles
mkdir build
cd build
cmake ..
make
sudo make install
```
