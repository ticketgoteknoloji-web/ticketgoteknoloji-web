import 'package:flutter_test/flutter_test.dart';
import 'package:ticketgo_document_reader/features/mrz/mrz_models.dart';
import 'package:ticketgo_document_reader/features/mrz/mrz_service.dart';
import 'package:ticketgo_document_reader/features/qr_session/qr_session_service.dart';
import 'package:ticketgo_document_reader/features/scanner/tckn_validator.dart';
import 'package:ticketgo_document_reader/models/document_result.dart';
import 'package:ticketgo_document_reader/services/document_validation_service.dart';

void main() {
  final mrz = MrzService();

  test('TD3 MRZ parse', () {
    final parsed = mrz.parse(SyntheticMrzFactory.passportAhmetYilmazRaw());
    expect(parsed.success, isTrue);
    expect(parsed.checkDigitsValid, isTrue);
    expect(parsed.format, MrzFormat.td3);
    expect(parsed.surname, 'YILMAZ');
    expect(parsed.givenNames, 'AHMET');
    expect(parsed.documentNumber, 'U12345678');
    expect(parsed.sex, 'M');
  });

  test('TD1 MRZ parse', () {
    final parsed = mrz.parse(SyntheticMrzFactory.turkishIdAhmetYilmazRaw());
    expect(parsed.success, isTrue);
    expect(parsed.checkDigitsValid, isTrue);
    expect(parsed.format, MrzFormat.td1);
    expect(parsed.documentNumber, 'A12B34567');
    expect(parsed.identityNumber, '10000000146');
  });

  test('MRZ check digit', () {
    expect(MrzCheckDigit.compute('U12345678'), '4');
    expect(MrzCheckDigit.compute('900101'), '1');
    expect(MrzCheckDigit.verify('900101', '1'), isTrue);
  });

  test('TCKN validation is algorithmic only', () {
    expect(TcknValidator.isValid('10000000146'), isTrue);
    expect(TcknValidator.isValid('10000000147'), isFalse);
    expect(TcknValidator.isValid('00000000146'), isFalse);
  });

  test('DocumentResult JSON', () {
    const result = DocumentResult(
      documentType: 'PASSPORT',
      documentNumber: 'U12345678',
      identityNumber: null,
      firstName: 'AHMET',
      lastName: 'YILMAZ',
      nationality: 'TUR',
      birthDate: '1990-01-01',
      gender: 'M',
      expiryDate: '2030-01-01',
      issuingCountry: 'TUR',
      mrzValid: true,
      confidence: 97.8,
      mrz:
          'P<TURYILMAZ<<AHMET<<<<<<<<<<<<<<<<<<<<<<<\nU123456784TUR9001011M3001017<<<<<<<<<<<<<<06',
    );
    final json = result.toJson();
    expect(json['documentType'], 'PASSPORT');
    expect(json['identityNumber'], isNull);
    expect(json['confidence'], 97.8);
    expect(json['mrzValid'], isTrue);
    expect(json['mrz'], contains('\n'));
    expect(json['mrz'].split('\n'), hasLength(2));
    final roundtrip = DocumentResult.fromJson(json);
    expect(roundtrip.lastName, 'YILMAZ');
    expect(roundtrip.mrz, json['mrz']);
  });

  test('session QR parse', () {
    final payload = QrSessionService().parse(
      'ticketgo-reader://scan?sessionId=abc123&type=passport',
    );
    expect(payload.sessionId, 'abc123');
    expect(payload.type, DocumentKind.passport);
  });

  test('API response mapping from validation', () {
    final parsed = mrz.parse(SyntheticMrzFactory.passportAhmetYilmazRaw());
    final result = DocumentValidationService().mergeAndScore(
      kind: DocumentKind.passport,
      mrz: parsed,
      sharpness: 90,
    );
    expect(result.documentType, 'PASSPORT');
    expect(result.mrzValid, isTrue);
    expect(result.confidence >= 70, isTrue);
    expect(result.toJson().containsKey('firstName'), isTrue);
    expect(result.toJson()['mrz'], parsed.raw);
    expect(result.toJson()['mrz'].split('\n'), hasLength(2));
  });
}
