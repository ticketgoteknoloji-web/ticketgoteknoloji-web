"""Vehicle-registration field extraction tests — synthetic text only.

Note: `app.ocr.general` imports `app.ocr.engine` for the *OCR-calling*
function (`read_general_ocr`), but that module's `paddleocr` import is
lazy (only executed inside the FastAPI-lifespan model loader), so this
test file can import and exercise `extract_vehicle_fields()` directly
without paddleocr/paddlepaddle installed — only numpy/opencv-python-headless
(needed transitively by app.ocr.passport_mrz / app.ocr.detector) are
required.
"""

from __future__ import annotations

from app.ocr.general import OcrLine, extract_vehicle_fields


def _lines(*texts: str) -> list[OcrLine]:
    return [OcrLine(text=t, confidence=0.9, bounding_box=[]) for t in texts]


def _full_synthetic_document() -> list[OcrLine]:
    return _lines(
        "MOTORLU TAŞIT TESCİL BELGESİ",
        "Tescil Plakası: 34 ABC 123",
        "Marka: TOYOTA",
        "Model: COROLLA",
        "Araç Cinsi: Otomobil",
        "Araç Sınıfı: M1",
        "Model Yılı: 2022",
        "Şasi No: 1HGCM82633A123456",
        "Motor No: AB1234567",
        "Yakıt Türü: Benzin",
        "Rengi: Beyaz",
        "Koltuk Sayısı: 5",
        "İlk Tescil Tarihi: 01.01.2022",
        "Tescil Tarihi: 15.03.2022",
        "Belge No: TEST0001",
        "Adı Soyadı: SENTETIK KULLANICI",
    )


def test_full_document_extracts_every_field():
    fields = extract_vehicle_fields(_full_synthetic_document())
    assert fields["plate"] == "34 ABC 123"
    assert fields["brand"] == "TOYOTA"
    assert fields["model"] == "COROLLA"
    assert fields["vehicleType"] == "CAR"
    assert fields["vehicleClass"] == "M1"
    assert fields["modelYear"] == "2022"
    assert fields["vin"] == "1HGCM82633A123456"
    assert fields["engineNumber"] == "AB1234567"
    assert fields["fuelType"] == "GASOLINE"
    assert fields["color"] == "Beyaz"
    assert fields["seatCount"] == "5"
    assert fields["ownerName"] == "SENTETIK KULLANICI"
    assert fields["documentNumber"] == "TEST0001"


def test_first_registration_and_registration_date_do_not_collide():
    """'Tescil Tarihi' is a substring of 'İlk Tescil Tarihi' — the two
    labeled dates must resolve to their own values, not to each other."""
    fields = extract_vehicle_fields(_full_synthetic_document())
    assert fields["firstRegistrationDate"] == "01.01.2022"
    assert fields["registrationDate"] == "15.03.2022"
    assert fields["firstRegistrationDate"] != fields["registrationDate"]


def test_registration_date_falls_back_when_no_explicit_label():
    lines = _lines("Tescil Plakası: 34 ABC 123", "15.03.2022")
    fields = extract_vehicle_fields(lines)
    assert fields["registrationDate"] == "15.03.2022"


def test_seat_count_is_not_borrowed_from_a_following_date_line():
    """Regression test: seatCount used to fall through to the NEXT line's
    text when the labeled value was a single digit (below the generic
    _labeled_value 2-character minimum), silently grabbing an unrelated
    date field."""
    lines = _lines(
        "Koltuk Sayısı: 5",
        "İlk Tescil Tarihi: 01.01.2022",
    )
    fields = extract_vehicle_fields(lines)
    assert fields["seatCount"] == "5"


def test_engine_number_does_not_false_positive_on_document_title():
    """Regression test: the 'motor' keyword fallback used to match the word
    'MOTORLU' inside the document title itself ('MOTORLU TAŞIT TESCİL
    BELGESİ') when no explicit 'Motor No' label was present."""
    lines = _lines(
        "MOTORLU TAŞIT TESCİL BELGESİ",
        "Tescil Plakası: 34 ABC 123",
    )
    fields = extract_vehicle_fields(lines)
    assert fields["engineNumber"] is None


def test_engine_number_still_found_via_motor_keyword_fallback():
    """The unlabeled 'motor' keyword fallback is intentionally coarse — it
    grabs the first ≥6-char alphanumeric token after a 'motor' mention, so
    it works best when that token immediately follows. It is not expected
    to skip over intervening unrelated words; that precision requires an
    explicit 'Motor No' label (see test_full_document_extracts_every_field)."""
    lines = _lines(
        "Tescil Plakası: 34 ABC 123",
        "Motor ABX987654",
    )
    fields = extract_vehicle_fields(lines)
    assert fields["engineNumber"] == "ABX987654"


def test_missing_fields_stay_null_never_invented():
    fields = extract_vehicle_fields(_lines("Rastgele okunamayan bir belge metni"))
    assert fields["plate"] is None
    assert fields["vin"] is None
    assert fields["vehicleClass"] is None
    assert fields["fuelType"] is None
    assert fields["seatCount"] is None
    assert fields["firstRegistrationDate"] is None


def test_vehicle_type_and_fuel_type_keyword_detection():
    fields = extract_vehicle_fields(_lines("Araç Cinsi: Kamyon", "Yakıt Türü: Dizel"))
    assert fields["vehicleType"] == "TRUCK"
    assert fields["fuelType"] == "DIESEL"


def test_electric_and_hybrid_fuel_detection():
    assert extract_vehicle_fields(_lines("Yakıt: Elektrik"))["fuelType"] == "ELECTRIC"
    assert extract_vehicle_fields(_lines("Yakıt: Hibrit"))["fuelType"] == "HYBRID"


def test_vin_is_not_confused_with_plate():
    fields = extract_vehicle_fields(
        _lines("Tescil Plakası: 34 ABC 123", "Şasi No: WVWZZZ1KZAW123456")
    )
    assert fields["vin"] == "WVWZZZ1KZAW123456"
    assert fields["vin"] != fields["plate"]
