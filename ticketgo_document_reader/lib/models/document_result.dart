import 'dart:convert';

class DocumentResult {
  const DocumentResult({
    required this.documentType,
    this.documentNumber,
    this.identityNumber,
    required this.firstName,
    required this.lastName,
    this.nationality,
    this.birthDate,
    this.gender,
    this.expiryDate,
    this.issuingCountry,
    required this.mrzValid,
    required this.confidence,
    this.mrz,
    this.placeOfBirth,
    this.dateOfIssue,
    this.warning,
  });

  final String documentType;
  final String? documentNumber;
  final String? identityNumber;
  final String firstName;
  final String lastName;
  final String? nationality;
  final String? birthDate;
  final String? gender;
  final String? expiryDate;
  final String? issuingCountry;
  final bool mrzValid;
  final double confidence;
  final String? mrz;
  final String? placeOfBirth;
  final String? dateOfIssue;
  final String? warning;

  DocumentResult copyWith({
    String? documentType,
    String? documentNumber,
    String? identityNumber,
    String? firstName,
    String? lastName,
    String? nationality,
    String? birthDate,
    String? gender,
    String? expiryDate,
    String? issuingCountry,
    bool? mrzValid,
    double? confidence,
    String? mrz,
    String? placeOfBirth,
    String? dateOfIssue,
    String? warning,
  }) {
    return DocumentResult(
      documentType: documentType ?? this.documentType,
      documentNumber: documentNumber ?? this.documentNumber,
      identityNumber: identityNumber ?? this.identityNumber,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      nationality: nationality ?? this.nationality,
      birthDate: birthDate ?? this.birthDate,
      gender: gender ?? this.gender,
      expiryDate: expiryDate ?? this.expiryDate,
      issuingCountry: issuingCountry ?? this.issuingCountry,
      mrzValid: mrzValid ?? this.mrzValid,
      confidence: confidence ?? this.confidence,
      mrz: mrz ?? this.mrz,
      placeOfBirth: placeOfBirth ?? this.placeOfBirth,
      dateOfIssue: dateOfIssue ?? this.dateOfIssue,
      warning: warning ?? this.warning,
    );
  }

  Map<String, dynamic> toJson() => {
        'documentType': documentType,
        'documentNumber': documentNumber,
        'identityNumber': identityNumber,
        'firstName': firstName,
        'lastName': lastName,
        'nationality': nationality,
        'birthDate': birthDate,
        'gender': gender,
        'expiryDate': expiryDate,
        'issuingCountry': issuingCountry,
        'mrzValid': mrzValid,
        'confidence': double.parse(confidence.toStringAsFixed(1)),
        'mrz': mrz,
      };

  factory DocumentResult.fromJson(Map<String, dynamic> json) {
    return DocumentResult(
      documentType: json['documentType'] as String? ?? 'UNKNOWN',
      documentNumber: json['documentNumber'] as String?,
      identityNumber: json['identityNumber'] as String?,
      firstName: json['firstName'] as String? ?? '',
      lastName: json['lastName'] as String? ?? '',
      nationality: json['nationality'] as String?,
      birthDate: json['birthDate'] as String?,
      gender: json['gender'] as String?,
      expiryDate: json['expiryDate'] as String?,
      issuingCountry: json['issuingCountry'] as String?,
      mrzValid: json['mrzValid'] as bool? ?? false,
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
      mrz: json['mrz'] as String?,
    );
  }

  String encode() => jsonEncode(toJson());

  static DocumentResult decode(String raw) =>
      DocumentResult.fromJson(jsonDecode(raw) as Map<String, dynamic>);
}

class ConfidenceLabel {
  static String describe(double score) {
    if (score >= 90) return 'Başarılı';
    if (score >= 70) return 'Kontrol Ediniz';
    return 'Tekrar Tarama Önerilir';
  }

  static String band(double score) {
    if (score >= 90) return 'high';
    if (score >= 70) return 'medium';
    return 'low';
  }
}

enum DocumentKind { turkishId, passport }

enum IdScanStep { front, back }

class ScanRequest {
  const ScanRequest({
    required this.kind,
    this.sessionId,
    this.step = IdScanStep.front,
    this.frontPartial,
  });

  final DocumentKind kind;
  final String? sessionId;
  final IdScanStep step;
  final DocumentResult? frontPartial;
}

class QrScanPayload {
  const QrScanPayload({required this.sessionId, required this.type});

  final String sessionId;
  final DocumentKind type;
}
