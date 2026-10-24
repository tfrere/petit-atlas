#!/usr/bin/env python3
"""Construit les champs de vent et de courants marins (climatologies) utilisés pour les particules animées.

Sources (libres de droits, sans clé d'API) :
  - Vent de surface : NCEP/NCAR Reanalysis, moyennes mensuelles de long terme (sig995, 2,5°), NOAA PSL.
  - Courants de surface : SODA 3.3.1 (Carton et al., 2018), niveau ~5 m, 0,5°, via NOAA CoastWatch ERDDAP.

Sortie : public/data/flow/{wind,currents}.json
  { nx, ny, lon0, lat0, dlon, dlat, scale, months: [{ u, v }] }
  - grille régulière : le point (i, j) est en (lon0 + i*dlon, lat0 + j*dlat), du nord au sud (dlat < 0)
  - u, v : Int8 encodés en base64, valeur réelle = int8 * scale (m/s), -128 = pas de donnée (terre)

Usage : pip install netCDF4 numpy && python3 scripts/build-flow-data.py [--years 2006-2015]
"""

import argparse
import base64
import json
import os
import tempfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import netCDF4 as nc
import numpy as np

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'flow')
NCEP = 'https://downloads.psl.noaa.gov/Datasets/ncep.reanalysis.derived/surface/{v}wnd.sig995.mon.ltm.nc'
SODA = (
    'https://coastwatch.pfeg.noaa.gov/erddap/griddap/erdSoda331oceanmday_LonPM180.nc'
    '?u%5B(@T)%5D%5B0%5D%5B0:1:329%5D%5B0:1:719%5D,v%5B(@T)%5D%5B0%5D%5B0:1:329%5D%5B0:1:719%5D'
)


def fetch(url, path):
    for attempt in range(4):
        try:
            urllib.request.urlretrieve(url, path)
            return
        except Exception:
            if attempt == 3:
                raise


def encode(a, scale):
    q = np.where(np.isnan(a), -128, np.clip(np.round(a / scale), -127, 127)).astype(np.int8)
    return base64.b64encode(q.tobytes()).decode()


def write(name, nx, ny, lon0, lat0, dlon, dlat, scale, months):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    payload = {
        'nx': nx, 'ny': ny, 'lon0': lon0, 'lat0': lat0, 'dlon': dlon, 'dlat': dlat, 'scale': scale,
        'months': [{'u': encode(u, scale), 'v': encode(v, scale)} for u, v in months],
    }
    with open(path, 'w') as f:
        json.dump(payload, f, separators=(',', ':'))
    print(name, f'{os.path.getsize(path) / 1024:.0f} Ko')


def wind():
    tmp = tempfile.mkdtemp()
    fields = {}
    for c in 'uv':
        p = os.path.join(tmp, f'{c}.nc')
        fetch(NCEP.format(v=c), p)
        d = nc.Dataset(p)
        a = np.ma.filled(d[f'{c}wnd'][:], np.nan)
        lon = d['lon'][:]
        shift = int(np.argmax(lon >= 180))
        fields[c] = np.roll(a, -shift, axis=2)  # 0..360 -> -180..180
    lat = d['lat'][:]
    months = [(fields['u'][m], fields['v'][m]) for m in range(12)]
    write('wind.json', 144, 73, -180.0, float(lat[0]), 2.5, float(lat[1] - lat[0]), 0.125, months)


def currents(y0, y1):
    tmp = tempfile.mkdtemp()
    jobs = [(m, y) for m in range(1, 13) for y in range(y0, y1 + 1)]

    def run(job):
        m, y = job
        t = f'{y}-{m:02d}-16'
        p = os.path.join(tmp, f'{y}{m:02d}.nc')
        fetch(SODA.replace('@T', t), p)
        d = nc.Dataset(p)
        u = np.ma.filled(d['u'][0, 0], np.nan)
        v = np.ma.filled(d['v'][0, 0], np.nan)
        lat = d['latitude'][:]
        d.close()
        os.remove(p)
        return m, u, v, lat

    sums = {m: [[], []] for m in range(1, 13)}
    with ThreadPoolExecutor(4) as pool:
        for m, u, v, lat in pool.map(run, jobs):
            sums[m][0].append(u)
            sums[m][1].append(v)
    months = []
    with np.errstate(all='ignore'):
        for m in range(1, 13):
            u = np.nanmean(np.stack(sums[m][0]), axis=0)
            v = np.nanmean(np.stack(sums[m][1]), axis=0)
            months.append((half(u), half(v)))
    ny = months[0][0].shape[0]
    # la grille SODA va du sud (-74,75°) au nord (89,75°) ; on la renverse pour aller du nord au sud
    months = [(u[::-1], v[::-1]) for u, v in months]
    lat_north = float((lat[-2] + lat[-1]) / 2)
    write('currents.json', 360, ny, -179.5, lat_north, 1.0, -1.0, 0.02, months)


def half(a):
    """0,5° -> 1° en moyennant les 2x2 cellules (au moins 2 valides, sinon pas de donnée)."""
    ny, nx = a.shape
    a = a[: ny - ny % 2, : nx - nx % 2]
    blocks = a.reshape(a.shape[0] // 2, 2, a.shape[1] // 2, 2)
    valid = np.sum(~np.isnan(blocks), axis=(1, 3))
    with np.errstate(all='ignore'):
        mean = np.nanmean(blocks, axis=(1, 3))
    return np.where(valid >= 2, mean, np.nan)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--years', default='2006-2015')
    ap.add_argument('--only', choices=['wind', 'currents'])
    args = ap.parse_args()
    y0, y1 = (int(x) for x in args.years.split('-'))
    if args.only != 'currents':
        wind()
    if args.only != 'wind':
        currents(y0, y1)
