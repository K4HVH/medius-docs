"""Device shapes the comparison and the firmware's own checks present on a USB device emulator (the sim).

A shape is plain data: descriptor bytes, endpoint lists, canned control answers and motion records. Nothing
here talks to a sim; `personalities.build` turns a shape into what the sim's library uploads, and
`personalities` is the only module that reaches that library.
"""
