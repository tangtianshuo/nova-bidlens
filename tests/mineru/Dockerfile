FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y fonts-noto-cjk fontconfig libgl1 && \
    fc-cache -fv && \
    apt-get clean

RUN pip install --no-cache-dir 'mineru[pipeline]>=3.4.0' \
    -i https://mirrors.aliyun.com/pypi/simple

ENV MINERU_MODEL_SOURCE=modelscope
RUN mineru-models-download -s modelscope -m pipeline

ENTRYPOINT ["mineru"]
