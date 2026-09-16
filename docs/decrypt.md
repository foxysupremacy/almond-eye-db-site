# Uma Musume Network Decryption — Handoff Document

**Date:** 2026-06-29
**Dumps analyzed:** `data/dumps/dump_2_27_5.cs` (Steam PC), `data/dumps/dump_2_28_0.cs` (Android)
**Live traffic:** iOS v2.28.0 captured via mitmproxy

---

## 1. Platform Security Matrix

```
                        STEAM PC              ANDROID            iOS
                        ────────              ───────            ───
App-layer encryption    ✅ AES-256 RJ          ✅ AES-256 RJ       ✅ AES-256 RJ
Certificate pinning     ❌ None                ❌ None             ❌ None
Anti-tamper             Coneshell             Coneshell          Unknown
API serialization       MsgPack + LZ4          MsgPack + LZ4      MsgPack + LZ4
Native header           CommonHeader()         CommonHeader()     CommonHeader()
Key exchange            StartSession nonce     StartSession nonce Same
```

All three platforms use the same cryptosystem. The only difference is header format (native code differs per platform).

---

## 2. Network Architecture

### Two separate API systems

| | Auth/Session | Game API |
|---|---|---|
| **Host** | `api-common01.cygames.jp` | `api.games.umamusume.jp` |
| **Content-Type** | `application/x-www-form-urlencoded` | `application/x-msgpack` |
| **Encryption** | ❌ None | ✅ `EncryptRJ256` |
| **Example** | `POST /api/v2/session` | `POST /umamusume/circle/detail` |

### Request/Response Pipeline

```
SEND:
  MessagePack.Serialize(request) → byte[]
  → LZ4 compress (if IsCompressed, payload > 64 bytes)
  → CryptAES.EncryptRJ256(byte[]) → encrypted byte[]
  → LibNative.Network.CommonHeader() → native header byte[]
  → [CommonHeader] + [encrypted payload] → HTTP POST body
  → TLS

RECEIVE:
  TLS → HTTP response body
  → strip CommonHeader
  → CryptAES.DecryptRJ256(byte[]) → decrypted byte[]
  → LZ4 decompress (if compressed)
  → MessagePack.Deserialize<T>(byte[]) → typed response
```

### Key HTTP Headers (iOS captured)

```
sid:            b0be7540a53eca5dabbd44be71b4f592   (session ID, from login)
viewerid:       602778906                            (user ID)
device:         1                                    (1=iOS, 2=Android)
app-ver:        2.28.0
res-ver:        10020030:TbAQ3mqUIEZm                (resource version)
device-subtype: 1
x-unity-version: 2022.3.62f2
Content-Type:   application/x-msgpack
```

---

## 3. Cryptosystem Details

### Algorithm: Rijndael-256-256 ("RJ256")

| Parameter | Value | Source |
|---|---|---|
| Algorithm | `RijndaelManaged` (NOT AES) | `System.Core.dll` |
| Block size | **256 bits** (32 bytes) | `CryptAES.BLOCK_SIZE = 256` |
| Key size | **256 bits** (32 bytes) | `CryptAES.KEY_SIZE = 256` |
| Rounds | 14 | Rijndael spec |
| Mode | CBC or CFB | Mono default, `FBENCRYPT_BLOCK_SIZE_16 = 16` |
| Padding | PKCS7 (likely) | Mono default |
| Implementation | Pure managed C# | `RijndaelManagedTransform` |

### Class Hierarchy

```
Cute.Core.Cryptographer          ← stateless public API (key+IV passed as args)
  (PC: line 1471116 / Android: line 731481)
  EncryptRJ256(src, key, iv)
  DecryptRJ256(src, key, iv)
  CreateKey() / CreateIV()
          │
          ▼ delegates to
Gallop.CryptAES                  ← stateful convenience layer (static key/IV)
  (PC: line 473745 / Android: line 731451)
  EncryptRJ256(byte[])           ← key/IV from static fields
  DecryptRJ256(byte[])
  KEY_SIZE = 256, BLOCK_SIZE = 256
          │
          ▼ uses
System.Security.Cryptography.RijndaelManaged
  CreateEncryptor(key, iv) → RijndaelManagedTransform
```

### Error Handling

```
ErrorType enum (PC: line 1472969 / Android: line 1488692):
  ResultCode = 0
  TimeOut = 1
  WwwError = 2
  DeserializeError = 3
  DecryptError = 4     ← confirms decryption is a formal pipeline step
```

---

## 4. Key Derivation

### Key material from login handshake

```
Client                                    Server
  │                                          │
  │─ ToolStartSessionRequest ──────────────→│
  │   attestation_type, device_token         │
  │                                          │
  │←─ ToolStartSessionResponse ────────────│
  │   CommonResponse {                       │
  │     nonce:    "..."       ← key seed     │
  │     auth_key: "..."       ← key seed     │
  │   }                                      │
  │                                          │
  │  InitializeConeshell()                   │
  │    key = ComputeHash(auth_key + nonce)   │
  │    iv  = GenerateIvString()              │
  │    → stored as static fields in CryptAES │
  │                                          │
  │── ALL subsequent game API requests ────→│
     encrypted with that same key/IV pair
```

**The session endpoint at `api-common01.cygames.jp` is UNENCRYPTED** — captures the `nonce` + `auth_key` from the start-session response here.

### Key derivation primitives (Gallop.Cryptographer)

```csharp
GenerateKeyString()   // random 256-bit key string
GenerateIvString()    // random IV string
ComputeHash(string)   // SHA-256 derivation
MakeMd5(string)       // MD5 hashing
Encode(string)        // custom table encoding
Decode(string)        // custom table decoding
```

### Key storage

- `Gallop.Certification` — singleton, stores `_sessionId`, `_viewerId`, `_udid`
- `HttpHelper.UpdateSessionID(ResponseCommon)` — persists session ID from DataHeader.sid
- `ResponseCache.AddCache(task, byte[] decryptResponseData)` — caches decrypted responses

---

## 5. Coneshell

Cygames proprietary anti-tamper library. Present on all platforms.

```
HttpHelper.InitializeConeshell()   ← called during HTTP pipeline init
HttpHelper.ReleaseConeshell()      ← called during shutdown
```

Implementation is in native code (`libnative.so` / `LibNative.dll`), not visible in IL2CPP dumps.

**Root tolerance confirmed**: Game launches and plays normally on rooted Android with MagiskHide. Likely only detects active tampering (Frida hooks, ptrace, memory patches), not passive device state.

---

## 6. PcgRandom — NOT Relevant

`ExpressionEvaluator.PcgRandom` is Unity's built-in PCG-XSH-RR RNG, used **exclusively** for the `rand()` function in Unity UI numeric fields (`Op.Rand = 14`). Static singleton `s_Random` on `ExpressionEvaluator`. No connection to networking, encryption, or LZ4.

---

## 7. Live Traffic Captures (iOS v2.28.0)

### Session (unencrypted)
```
POST https://api-common01.cygames.jp/api/v2/session
Content-Type: application/x-www-form-urlencoded
Body: ID=e9ddb9e3dbe41bda26f02bd294927078&notificationStatus=0
→ 200 OK, empty body
```
✅ Successfully replicated with `curl`.

### Game API (encrypted)
```
POST https://api.games.umamusume.jp/umamusume/circle/detail
Content-Type: application/x-msgpack
Body: 425 bytes binary (EncryptRJ256 encrypted)
→ 200 OK, encrypted MsgPack response
```
❌ Cannot parse — encrypted.

### Game API (encrypted, larger)
```
POST https://api.games.umamusume.jp/umamusume/account/get_by_icloud_data
Content-Type: application/x-msgpack
Body: 456 bytes binary (EncryptRJ256 encrypted)
→ 200 OK, 500 bytes binary (EncryptRJ256 encrypted)
```
❌ Cannot parse — encrypted. Attempting to parse as raw MsgPack or LZ4 fails.

---

## 8. Community Project: CarrotJuicer (PC/EXNOA)

After decryption, the PC request format is:
- Bytes 0-3: 4-byte LE uint32 `offset` (observed value: 166 = 0xA6)
- Bytes 4-55 (52 bytes): Fixed header per client
- Bytes 56 to 4+offset: Variable header per request
- Bytes 4+offset onward: Standard MsgPack payload

Response format: Raw MsgPack directly (no offset/header).

This format may differ on mobile — the native `CommonHeader()` implementation varies per platform.

---

## 9. Next Steps

1. **Capture the session handshake** — mitmproxy the `api-common01.cygames.jp` traffic to get `nonce` + `auth_key` from `ToolStartSessionResponse`
2. **Derive the session key** — implement `ComputeHash(auth_key + nonce)` to get the 256-bit Rijndael key
3. **Decrypt game API traffic** — apply `RijndaelManaged.CreateDecryptor(key, iv)` to the `api.games.umamusume.jp` payloads
4. **Verify LZ4 status** — after decryption, check if the MsgPack is LZ4-compressed (try decompressing if parsing fails)
5. **Reverse CommonHeader format** — decompile `libnative.so` (Android) or the iOS native framework with Ghidra/IDA to understand the native header binary format
6. **Test on Android** — capture live Android traffic to compare format with iOS
7. **PC traffic analysis** — capture a PC session to confirm the 166-byte offset format and the `Cute.Core.Cryptographer` usage

---

## 10. Key Files Reference

### dump_2_27_5.cs (Steam PC)

| Item | Line |
|---|---|
| `Cute.Core.Cryptographer` | 1471116 |
| `Cute.Http.ErrorType` (DecryptError=4) | 1472969 |
| `Cute.Http.HttpManager` | 1473039 |
| `Cute.Http.IHttpTask` | 1473261 |
| `Cute.Http.WWWRequest` | 1473415 |
| `Gallop.CryptAES` | 473745 |
| `Gallop.Cryptographer` | 473782 |
| `Gallop.Certification` | 473664 |
| `Gallop.HttpHelper` | 486178 |
| `Gallop.HttpHelper.InitializeConeshell()` | 486314 |
| `LibNative.Network.CommonHeader()` | 1478916 |
| `MessagePack.LZ4.LZ4Codec` | 1362166 |
| `LZ4MessagePackSerializer` | 1352904 |
| `ExpressionEvaluator.PcgRandom` | 1177642 |
| `ExpressionEvaluator.s_Random` | 1177739 |
| `System.Security.Cryptography.RijndaelManaged` | 731739 |

### dump_2_28_0.cs (Android)

| Item | Line |
|---|---|
| `Gallop.CryptAES` | 731451 |
| `Gallop.Cryptographer` | 731481 |
| `Gallop.Certification` | 731374 |
| `Gallop.HttpHelper` | 742012 |
| `HttpHelper.InitializeConeshell()` | 742073 |
| `HttpHelper.CompressRequest(byte[])` | 742069 |
| `HttpHelper.DecompressResponse(byte[])` | 742071 |
| `Cute.Http.ErrorType` (DecryptError=4) | 1488692 |
| `Cute.Http.HttpManager` | 1488758 |
| `Cute.Http.ResponseCache.AddCache(task, decryptResponseData)` | 1489036 |
| `Cute.Http.IHttpTask` | 1488904 |
| `Cute.Http.IWebRequest` | 1488984 |
| `Cute.Http.WWWRequest` | 1489070 |
| `LibNative.Network.CommonHeader()` | 1492392 |
| `LibNative.LZ4.SimpleLZ4Frame` | 1493371 |
| `MessagePack.LZ4.LZ4Codec` | 1420590 |
| `LZ4MessagePackSerializer` | 1415724 |
| `Gallop.RequestCommon` | 991946 |
| `Gallop.ResponseCommon` | 991974 |
| `Gallop.DataHeader` | 987888 |
| `PcgRandom` struct | 1289351 |
| `ExpressionEvaluator.s_Random` | 1289456 |
| `RequestBase<T>` | 991927 |
