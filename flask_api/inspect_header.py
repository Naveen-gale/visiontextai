with open('d:/ImageToPDF/theme_model.pkl', 'rb') as f:
    header = f.read(20)
    print("Header bytes:", header)
    print("Header hex:", header.hex())
