import json
import jsbeautifier

jfile = None
with open('data.json') as infile:
    jfile = json.load(infile)

    for (key, entry) in jfile.items():
        uniques = list({ e : e for e in entry}.values())
        uniques.sort()
        jfile[key] = uniques

options = jsbeautifier.default_options()
options.indent_size = 2
with open('data.json', 'w') as outfile:
    outfile.write(jsbeautifier.beautify( json.dumps(jfile), options))

