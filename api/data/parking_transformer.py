import json
import pandas as pd

df = pd.read_excel ('gates_db.xlsx')
with open('gates.json', 'w') as outfile:
    outfile.write("[\n")
    for (key,row) in df.iterrows():
        if(row[0] == ''):
            continue
        if(str(row[2]).rstrip().endswith("L")):
            continue
        #outfile.write("\t\"{}\":{{\n".format(row[1]))
        outfile.write("\t{\n")
        outfile.write("\t\t\"airport\": \"{}\",\n".format(str(row[0]).rstrip()))
        outfile.write("\t\t\"gate\": \"{}\",\n".format(str(row[2]).rstrip()))
        outfile.write("\t\t\"apron\": \"{}\",\n".format(row[1]))
        outfile.write("\t\t\"latitude\": {},\n".format(row[10]))
        outfile.write("\t\t\"longitude\": {}\n".format(row[14]))
        outfile.write("\t},\n")
    outfile.write("]")
