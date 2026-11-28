"""Fetch client configuration through the web port and verify archive checksums.

Usage: python3 -I fetch-config-assets.py <host> <empty-output-directory>

Writes npc.idx, npc.dat, loc.idx, loc.dat and interface.dat. The server's /crc
response lists each archive's checksum; every downloaded archive is rejected unless
its CRC matches. Nothing is preloaded: this is the same data an ordinary client reads.
"""

import bz2
import os
import struct
import sys
import urllib.request
import zlib

host, out = sys.argv[1], sys.argv[2]
if os.path.exists(out) and os.listdir(out):
    sys.exit('Output directory must be new or empty.')
os.makedirs(out, exist_ok=True)

opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def get(path):
    return opener.open(f'http://{host}:8888/{path}', timeout=10).read(4_000_000)


def number(raw):
    return int.from_bytes(raw, 'big')


crc = get('crc')
assert len(crc) == 40, 'unexpected checksum list'


def archive(name, slot):
    expected = struct.unpack_from('>i', crc, slot * 4)[0]
    raw = get(name + str(expected))
    assert zlib.crc32(raw) == (expected & 0xFFFFFFFF), f'{name} checksum mismatch'
    whole = number(raw[:3]) != number(raw[3:6])
    body = bz2.decompress(b'BZh1' + raw[6:]) if whole else raw[6:]
    count = number(body[:2])
    offset = 2 + 10 * count
    files = {}
    for i in range(count):
        entry = 2 + i * 10
        key = number(body[entry : entry + 4])
        size = number(body[entry + 4 : entry + 7])
        stored = number(body[entry + 7 : entry + 10])
        files[key] = (size, body[offset : offset + stored], whole)
        offset += stored
    return files


def item(files, name):
    key = 0
    for ch in name.upper():
        key = (key * 61 + ord(ch) - 32) & 0xFFFFFFFF
    size, value, whole = files[key]
    result = value if whole else bz2.decompress(b'BZh1' + value)
    assert len(result) == size, f'{name} size mismatch'
    return result


config = archive('config', 2)
interface = archive('interface', 3)
for target, source in [
    ('npc.idx', item(config, 'npc.idx')),
    ('npc.dat', item(config, 'npc.dat')),
    ('loc.idx', item(config, 'loc.idx')),
    ('loc.dat', item(config, 'loc.dat')),
    ('interface.dat', item(interface, 'data')),
]:
    with open(os.path.join(out, target), 'wb') as handle:
        handle.write(source)
print('Client configuration verified')
