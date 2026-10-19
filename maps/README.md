Map library
===========
Put PNG (with transparent sky) or Worms Armageddon style PNG/BMP maps in this folder and list them in
manifest.json:

  { "maps": [ { "name": "My map", "file": "my-map.png" }, "other.png" ] }

Entries can be objects or plain file names. Served over http(s) the game reads maps/manifest.json by
itself; from a file or the artifact page use "Load maps folder..." in the menu and pick this folder
(manifest.json is used when present, otherwise every image in the folder is listed).
