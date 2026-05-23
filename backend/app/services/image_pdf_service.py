from __future__ import annotations

import base64
import re
from io import BytesIO
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


DATA_URL_RE = re.compile(r"^data:image/(png|jpeg|jpg);base64,", re.IGNORECASE)


def _decode_image_data_url(image_data: str) -> BytesIO:
    cleaned = DATA_URL_RE.sub("", image_data.strip())
    if not cleaned:
        raise ValueError("Preview image is empty.")
    try:
        return BytesIO(base64.b64decode(cleaned, validate=True))
    except Exception as exc:
        raise ValueError("Preview image is not valid base64 data.") from exc


def generate_pdf_from_preview_images(path: Path, images: list[str]) -> Path:
    if not images:
        raise ValueError("At least one preview image is required.")

    pdf = canvas.Canvas(str(path), pagesize=A4)
    page_width, page_height = A4

    for index, image_data in enumerate(images):
        if index > 0:
            pdf.showPage()

        image_reader = ImageReader(_decode_image_data_url(image_data))
        pdf.drawImage(
            image_reader,
            0,
            0,
            width=page_width,
            height=page_height,
            preserveAspectRatio=False,
            mask="auto",
        )

    pdf.save()
    return path
