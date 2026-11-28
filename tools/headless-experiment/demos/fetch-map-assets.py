"""Fetch one map region's ground and location files and verify their checksums.

Usage: python3 -I fetch-map-assets.py <host> <empty-output-directory> <world-x> <world-z>

Writes ground.bin and region.bin for the 64x64 region containing the world tile. The
server advertises each map file's version and CRC in the client's version list; a file
is rejected unless both match. These are the same files an ordinary client requests.
"""

import bz2
import gzip
import os
import socket
import struct
import sys
import urllib.request
import zlib

host, out = sys.argv[1], sys.argv[2]
world_x, world_z = int(sys.argv[3]), int(sys.argv[4])
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


version_list = archive('versionlist', 5)
index = item(version_list, 'map_index')
versions = item(version_list, 'map_version')
crcs = item(version_list, 'map_crc')
region = ((world_x // 64) << 8) | (world_z // 64)
rows = [
    struct.unpack_from('>HHHB', index, i)
    for i in range(0, len(index), 7)
    if number(index[i : i + 2]) == region
]
assert rows, 'region not listed by the server'
_, ground_file, locations_file, _ = rows[0]


def map_file(file_id):
    with socket.create_connection((host, 43594), timeout=10) as connection:

        def exact(n):
            data = b''
            while len(data) < n:
                chunk = connection.recv(n - len(data))
                assert chunk, 'connection closed early'
                data += chunk
            return data

        connection.sendall(b'\x0f')
        exact(8)
        connection.sendall(bytes([3, file_id >> 8, file_id & 255, 2]))
        data = bytearray()
        size = None
        while size is None or len(data) < size:
            archive_id, num, size, part = struct.unpack('>BHHB', exact(6))
            assert archive_id == 3 and num == file_id and part * 500 == len(data) and size > 0
            data.extend(exact(min(500, size - len(data))))
    assert number(data[-2:]) == number(versions[file_id * 2 : file_id * 2 + 2]), 'version mismatch'
    assert zlib.crc32(data[:-2]) == number(crcs[file_id * 4 : file_id * 4 + 4]), 'crc mismatch'
    return gzip.decompress(data[:-2])


for target, file_id in [('ground.bin', ground_file), ('region.bin', locations_file)]:
    with open(os.path.join(out, target), 'wb') as handle:
        handle.write(map_file(file_id))
print('Map region verified')
