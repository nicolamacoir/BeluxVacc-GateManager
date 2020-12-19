import json
import pandas as pd

df = pd.read_excel ('parking_coords.xlsx')
with open('gates.json', 'w') as outfile:
    outfile.write("[\n")
    for (key,row) in df.iterrows():
        if(row[0] == ''):
            continue
        #outfile.write("\t\"{}\":{{\n".format(row[1]))
        outfile.write("\t{\n")
        outfile.write("\t\t\"gate\": \"{}\",\n".format(row[1]))
        outfile.write("\t\t\"apron\": \"{}\",\n".format(row[0]))
        outfile.write("\t\t\"latitude\": {},\n".format(row[9]))
        outfile.write("\t\t\"longitude\": {},\n".format(row[13]))
        outfile.write("\t\t\"occupied\": false,\n")
        outfile.write("\t\t\"assigned_to\": \"none\"\n")
        outfile.write("\t},\n")
    outfile.write("]")
