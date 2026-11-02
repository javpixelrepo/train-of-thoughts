"""Reduce the CC0 source GLBs to geometry, rig and the three motions we use.

Run beside maya-source.glb and sam-source.glb. No network access is needed.
"""
import json
import pathlib
import struct

ROOT = pathlib.Path(__file__).parent
for name in ('maya', 'sam'):
    source = (ROOT / f'{name}-source.glb').read_bytes()
    length = struct.unpack_from('<I', source, 12)[0]
    doc = json.loads(source[20:20 + length])
    binary = source[28 + length:]
    doc['animations'] = [a for a in doc['animations'] if a['name'] in ('Idle_Standing', 'Walk_Relaxed', 'Sit_Stand')]
    removed = {i for i, m in enumerate(doc['meshes']) if any(x in m.get('name', '') for x in ('Hairline', 'teeth', 'held accessory'))}
    meshes = {}
    for i, mesh in enumerate(doc['meshes']):
        if i not in removed:
            meshes[i] = len(meshes)
            for p in mesh['primitives']:
                p['attributes'] = {k: v for k, v in p['attributes'].items() if k in ('POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0')}
    for node in doc['nodes']:
        if 'mesh' in node:
            old = node.pop('mesh')
            if old in meshes:
                node['mesh'] = meshes[old]
    doc['meshes'] = [m for i, m in enumerate(doc['meshes']) if i in meshes]
    doc['materials'] = [{'name': m.get('name', ''), 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 1}} for m in doc['materials']]
    for key in ('textures', 'images', 'samplers', 'extensionsUsed', 'extensionsRequired'):
        doc.pop(key, None)
    refs = []
    for mesh in doc['meshes']:
        for p in mesh['primitives']:
            refs += [(p['attributes'], k) for k in p['attributes']]
            if 'indices' in p:
                refs.append((p, 'indices'))
    refs += [(s, 'inverseBindMatrices') for s in doc['skins']]
    refs += [(s, k) for a in doc['animations'] for s in a['samplers'] for k in ('input', 'output')]
    accessors = sorted({d[k] for d, k in refs})
    remap = {old: i for i, old in enumerate(accessors)}
    for d, k in refs:
        d[k] = remap[d[k]]
    doc['accessors'] = [doc['accessors'][i] for i in accessors]
    views = sorted({a['bufferView'] for a in doc['accessors']})
    remap = {old: i for i, old in enumerate(views)}
    packed = bytearray()
    output_views = []
    for old in views:
        v = dict(doc['bufferViews'][old])
        packed.extend(b'\0' * (-len(packed) % 4))
        start = v.get('byteOffset', 0)
        v['byteOffset'] = len(packed)
        packed.extend(binary[start:start + v['byteLength']])
        output_views.append(v)
    for a in doc['accessors']:
        a['bufferView'] = remap[a['bufferView']]
    doc['bufferViews'] = output_views
    packed.extend(b'\0' * (-len(packed) % 4))
    doc['buffers'] = [{'byteLength': len(packed)}]
    header = json.dumps(doc, separators=(',', ':')).encode()
    header += b' ' * (-len(header) % 4)
    result = struct.pack('<III', 0x46546c67, 2, 28 + len(header) + len(packed)) + struct.pack('<II', len(header), 0x4e4f534a) + header + struct.pack('<II', len(packed), 0x004e4942) + packed
    (ROOT / f'{name}.glb').write_bytes(result)
    print(f'{name}: {len(source):,} -> {len(result):,} bytes')
