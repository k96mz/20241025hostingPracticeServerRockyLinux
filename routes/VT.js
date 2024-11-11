// Set Module
const express = require("express");
const router = express.Router();
const config = require("config");
const fs = require("fs");
const cors = require("cors");
const MBTiles = require("@mapbox/mbtiles");

// Configure constant
const mbtilesDir = config.get("mbtilesDir");

// Global variables
let mbtilesPool = {};
let busy = false;

const app = express();
app.use(cors());

// Specify mbtiles
const getMBTiles = async (t, z, x, y) => {
  let mbtilesPath = `${mbtilesDir}/${t}.mbtiles`;
  return new Promise((resolve, reject) => {
    if (mbtilesPool[mbtilesPath]) {
      resolve(mbtilesPool[mbtilesPath].mbtiles);
    } else {
      if (fs.existsSync(mbtilesPath)) {
        new MBTiles(`${mbtilesPath}?mode=ro`, (err, mbtiles) => {
          if (err) {
            reject(new Error(`${mbtilesPath} could not open.`));
          } else {
            mbtilesPool[mbtilesPath] = {
              mbtiles: mbtiles,
              openTime: new Date(),
            };
            resolve(mbtilesPool[mbtilesPath].mbtiles);
          }
        });
      } else {
        reject(new Error(`${mbtilesPath} was not found.`));
      }
    }
  });
};

// Get tile
const getTile = async (mbtiles, z, x, y) => {
  return new Promise((resolve, reject) => {
    mbtiles.getTile(z, x, y, (err, tile, headers) => {
      if (err) {
        reject();
      } else {
        // console.log(`---------before------------`);
        // console.log({ tile: tile, headers: headers });
        resolve({ tile: tile, headers: headers });
      }
    });
  });
};

router.get("/zxy/:t/:z/:x/:y.pbf", async (req, res) => {
  busy = true;
  const t = req.params.t;
  const z = parseInt(req.params.z);
  const x = parseInt(req.params.x);
  const y = parseInt(req.params.y);

  // console.log(`t: ${t}, z: ${z}, x: ${x}, y: ${y}`);

  getMBTiles(t, z, x, y)
    .then((mbtiles) => {
      // console.log(mbtiles);
      getTile(mbtiles, z, x, y)
        .then((r) => {
          if (r.tile) {
            res.set("content-type", "application/vnd.mapbox-vector-tile");
            res.set("content-encoding", "gzip");
            res.set("last-modified", r.headers["Last-Modified"]);
            res.set("etag", r.headers["ETag"]);
            // console.log(`---------after------------`);
            // console.log({ tile: tile, headers: headers });
            res.send(r.tile);
            busy = false;
          } else {
            res
              .status(404)
              .send(`tile not found: /zxy/${t}/${z}/${x}/${y}.pbf`);
            busy = false;
          }
        })
        .catch((e) => {
          res
            .status(404)
            .send(
              `tile not found (getTile error): /zxy/${t}/${z}/${x}/${y}.pbf`
            );
          busy = false;
        });
    })
    .catch((e) => {
      res
        .status(404)
        .send(`mbtiles not found for /zxy/${t}/${z}/${x}/${y}.pbf`);
    });
});

module.exports = router;
