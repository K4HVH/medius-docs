def run(ctx):
    out = {}
    for leg in ctx.legs:
        ctx.device(leg)
        out[leg] = {"value": 1}
    return out
