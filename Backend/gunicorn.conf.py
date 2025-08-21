bind = "0.0.0.0:{}".format(__import__("os").environ.get("PORT", "5000"))
workers = 2
threads = 4
timeout = 60
accesslog = "-"
errorlog = "-"