#!/bin/bash -e

rm -rf node_modules

shasum --algorithm 256 manifest.json package.json *.js LICENSE README.md > SHA256SUMS

TARFILE=`npm pack`

shasum --algorithm 256 ${TARFILE} > ${TARFILE}.sha256sum

rm -rf SHA256SUMS package
