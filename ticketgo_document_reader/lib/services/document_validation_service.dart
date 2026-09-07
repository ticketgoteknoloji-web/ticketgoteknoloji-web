import 'package:ticketgo_document_reader/features/mrz/mrz_models.dart';
import 'package:ticketgo_document_reader/features/scanner/tckn_validator.dart';
import 'package:ticketgo_document_reader/models/document_result.dart';

class DocumentValidationService {
  DocumentResult mergeAndScore({
    required DocumentKind kind,
    MrzParseResult? mrz,
    VisualZoneResult? visual,
    double sharpness = 80,
  }) {
    var firstName = visual?.firstName ?? '';
    var lastName = visual?.lastName ?? '';
    var identity = visual?.identityNumber ?? '';
    var documentNumber = visual?.documentNumber ?? '';
    var nationality = visual?.nationality ?? '';
    var gender = visual?.sex ?? '';
    var birthDate = visual?.birthDate;
    var expiryDate = visual?.expiryDate;
    var issuing = '';
    var mrzValid = false;
    String? warning;

    if (mrz != null && mrz.success) {
      lastName = mrz.surname;
      firstName = mrz.givenNames;
      gender = mrz.sex;
      nationality = mrz.nationality;
      issuing = mrz.issuingCountry;
      birthDate = MrzDateParser.iso(mrz.dateOfBirth);
      expiryDate = MrzDateParser.iso(mrz.expiryDate);
      documentNumber = mrz.documentNumber;
      if (mrz.identityNumber.isNotEmpty) identity = mrz.identityNumber;
      mrzValid = mrz.checkDigitsValid;
      if (!mrzValid) {
        warning = kind == DocumentKind.passport
            ? 'Pasaport bilgileri doğrulanamadı. Lütfen tekrar tarayın.'
            : 'MRZ alanı geçersiz. Belgeyi tekrar tarayın.';
      }
    }

    final tcknOk = identity.isEmpty || TcknValidator.isValid(identity);
    if (identity.isNotEmpty && !tcknOk) {
      warning ??=
          'T.C. Kimlik No algoritmik olarak geçersiz görünüyor. Lütfen kontrol edin.';
    }

    if (expiryDate != null && expiryDate.isNotEmpty) {
      final parsed = DateTime.tryParse(expiryDate);
      if (parsed != null && parsed.isBefore(DateTime.now())) {
        warning ??= 'Belgenin son geçerlilik tarihi dolmuş.';
      }
    }

    var score = 20.0;
    if (mrz != null && mrz.success) score += 25;
    if (mrzValid) score += 25;
    if (mrz != null && mrz.wasCorrected) score -= 4;
    if (firstName.isNotEmpty && lastName.isNotEmpty) score += 8;
    if (birthDate != null && birthDate.isNotEmpty) score += 4;
    if (expiryDate != null && expiryDate.isNotEmpty) score += 4;
    if (documentNumber.isNotEmpty) score += 6;
    if (identity.isNotEmpty) score += tcknOk ? 6 : -8;
    if (sharpness >= 80) {
      score += 8;
    } else if (sharpness >= 40) {
      score += 4;
    } else {
      score -= 15;
    }
    score = score.clamp(0, 100);

    return DocumentResult(
      documentType: kind == DocumentKind.passport ? 'PASSPORT' : 'TURKISH_ID',
      documentNumber: documentNumber.isEmpty ? null : documentNumber,
      identityNumber: identity.isEmpty ? null : identity,
      firstName: firstName,
      lastName: lastName,
      nationality: nationality.isEmpty ? null : nationality,
      birthDate: (birthDate == null || birthDate.isEmpty) ? null : birthDate,
      gender: gender.isEmpty ? null : gender,
      expiryDate: (expiryDate == null || expiryDate.isEmpty) ? null : expiryDate,
      issuingCountry: issuing.isEmpty ? null : issuing,
      mrzValid: mrzValid,
      confidence: double.parse(score.toStringAsFixed(1)),
      mrz: (mrz == null || mrz.raw.isEmpty) ? null : mrz.raw,
      warning: warning,
    );
  }
}

class VisualZoneResult {
  VisualZoneResult({
    this.firstName,
    this.lastName,
    this.identityNumber,
    this.documentNumber,
    this.nationality,
    this.placeOfBirth,
    this.birthDate,
    this.expiryDate,
    this.sex,
  });

  String? firstName;
  String? lastName;
  String? identityNumber;
  String? documentNumber;
  String? nationality;
  String? placeOfBirth;
  String? birthDate;
  String? expiryDate;
  String? sex;
}

class VisualZoneParser {
  static VisualZoneResult parse(String ocrText) {
    final result = VisualZoneResult();
    result.identityNumber = _findTckn(ocrText);
    result.sex = _findSex(ocrText);
    if (RegExp(r'TÜRK|TURKISH|\bTUR\b', caseSensitive: false).hasMatch(ocrText)) {
      result.nationality = 'TUR';
    }
    result.documentNumber = RegExp(r'\b([A-Z]{1,3}\d{2}[A-Z]\d{5})\b')
        .firstMatch(ocrText.toUpperCase())
        ?.group(1);
    result.lastName = _label(ocrText, r'(?:SOYAD|SURNAME)\s*[:\s]+([A-ZÇĞİÖŞÜÂ ]{2,40})');
    result.firstName = _label(ocrText, r'(?:ADI|GIVEN|NAME)\s*[:\s]+([A-ZÇĞİÖŞÜÂ ]{2,40})');
    return result;
  }

  static String? _findTckn(String text) {
    final matches = RegExp(r'\d{11}').allMatches(text);
    for (final match in matches) {
      final value = match.group(0)!;
      if (TcknValidator.isValid(value)) return value;
    }
    return null;
  }

  static String? _findSex(String text) {
    if (RegExp(r'\b(KADIN|FEMALE|\bF\b)', caseSensitive: false).hasMatch(text)) {
      return 'F';
    }
    if (RegExp(r'\b(ERKEK|MALE|\bM\b)', caseSensitive: false).hasMatch(text)) {
      return 'M';
    }
    return null;
  }

  static String? _label(String text, String pattern) {
    final match = RegExp(pattern, caseSensitive: false).firstMatch(text);
    return match?.group(1)?.trim();
  }
}
