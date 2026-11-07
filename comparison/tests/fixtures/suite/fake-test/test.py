def run(ctx):
    ctx.device("rest")
    return {"rest": {"value": 7, "box": ctx.box_name, "run": ctx.run_index}}
