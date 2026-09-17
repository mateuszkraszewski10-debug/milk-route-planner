# Milk Route Planner

Offline PWA do planowania rozmieszczenia mleka w komorach samochodu i przyczepy podczas odbioru mleka z gospodarstw.

## Cel aplikacji

Aplikacja ma przed wyjazdem policzyć cały kurs i przypisać mleko z kolejnych gospodarstw do właściwych komór, z uwzględnieniem rzeczywistych ograniczeń technicznych i organizacyjnych.

Najważniejsze cele:
- zachowanie kolejności gospodarstw,
- niedopuszczenie do przepełnienia komór,
- możliwie mała liczba przepompowań,
- możliwie mała liczba dzielonych gospodarstw,
- preferowanie bezpośredniego nalewu do przyczepy, jeśli jest możliwy,
- zachowanie praktycznego zapasu pojemności,
- jasne pokazanie kierowcy, do której komory nalewać mleko teraz i gdzie ma ono ostatecznie trafić.

## Numeracja komór

Samochód:
- komora 1
- komora 2
- komora 3

Przyczepa:
- komora 4
- komora 5
- komora 6

Stałe pary przepompowania:
- 1 → 4
- 2 → 5
- 3 → 6

Przepompowanie krzyżowe, np. 1 → 5 albo 2 → 6, jest niedozwolone.

## Profile pojazdów

Każdy samochód i każda przyczepa mają własny profil zapisany pod numerem rejestracyjnym.

Profil zawiera trzy nominalne pojemności komór.

Przykład:
- samochód: 5300 / 5300 / 5300 l
- przyczepa: 5100 / 5000 / 6500 l

## Rezerwa techniczna

Każda komora ma twardą rezerwę techniczną:

**65 litrów**

Pojemność użytkowa:

```
pojemność użytkowa = pojemność nominalna - 65 l
```

Przykłady:
- 5300 l → 5235 l użytkowe
- 5100 l → 5035 l użytkowe
- 5000 l → 4935 l użytkowe
- 6500 l → 6435 l użytkowe

Algorytm nigdy nie może planować powyżej pojemności użytkowej.

## Praktyczny bufor

Poza twardą rezerwą 65 l algorytm preferuje dodatkowy wolny zapas, szczególnie przy większych odbiorach.

Orientacyjnie:
- małe gospodarstwa do ok. 1000 l mają zwykle mniejszą zmienność,
- średnie 1000–4000 l wymagają umiarkowanego zapasu,
- duże od ok. 4000 l powinny mieć większy margines,
- pożądany wolny zapas to zwykle ok. 100–300 l,
- dla dużych gospodarstw preferowany zapas to ok. 200–300 l.

To jest preferencja, a nie twardy limit. Jeżeli bez tego trasa nie byłaby możliwa, algorytm może wykorzystać komorę bliżej jej pojemności użytkowej.

## Kolejność gospodarstw

Kolejność gospodarstw na trasie jest stała.

Algorytm nie może:
- zmieniać kolejności,
- przeskakiwać gospodarstw,
- planować odbioru w innej kolejności niż wpisana.

## Prognoza litrów

Prognozą dla gospodarstwa jest ilość z poprzedniego odbioru.

Aplikacja zakłada, że odbiór jest zwykle co 2 dni.

Każde gospodarstwo musi mieć prognozę większą od 0 l.

## Wjazd z przyczepą

W interfejsie **„Przyczepa TAK” oznacza, że możliwy jest wjazd z przyczepą na dane gospodarstwo.**

Każde gospodarstwo ma informację:

**Wjazd z przyczepą: TAK / NIE**

Jeżeli:
- TAK — mleko może być nalewane do komór 1–6,
- NIE — fizycznie dostępne są tylko komory 1–3 samochodu.

Jeśli aplikacja działa w trybie **bez przyczepy**:
- komory 4–6 są całkowicie wyłączone,
- opcja „wjazd z przyczepą” nie ma znaczenia i jest ukryta w interfejsie.

## Bezpośredni nalew do przyczepy

Jeśli gospodarstwo ma wjazd z przyczepą, algorytm preferuje bezpośredni nalew do komór 4–6, o ile nie pogarsza to całego planu trasy.

Celem jest ograniczenie zbędnego przepompowywania.

## Przepompowanie

W całej trasie dozwolony jest maksymalnie **jeden postój na przepompowanie**.

Podczas tego postoju można przepompować:
- tylko 1 → 4,
- tylko 2 → 5,
- tylko 3 → 6,
- albo dowolną kombinację tych par.

Nie trzeba przepompowywać wszystkich trzech komór.

### Zasada pełnego transferu

Przepompowanie zawsze obejmuje całą aktualną zawartość komory samochodu.

Niedozwolone jest częściowe przepompowanie, np. tylko 2000 l z 5000 l.

Przykład:
- komora 1 ma 4800 l,
- komora 4 ma co najmniej 4800 l wolnego miejsca,
- można wykonać 1 → 4,
- po operacji komora 1 ma 0 l, a komora 4 dostaje całe 4800 l.

Jeśli komora przyczepy nie ma wystarczającego wolnego miejsca na całą zawartość paired komory samochodu, transfer tej pary jest niedozwolony.

## Preferowane miejsce przepompowania

Użytkownik może podać numer gospodarstwa, po którym preferowane jest przepompowanie.

Przykład:
- „po gospodarzu 10”

Algorytm najpierw próbuje znaleźć plan z przepompowaniem dokładnie w tym miejscu.

Jeżeli nie jest to możliwe, może szukać planu bez wymuszonego miejsca.

Jeżeli pole jest puste, algorytm może automatycznie wybrać naturalny punkt, np. koniec odcinka gospodarstw z dostępem dla przyczepy.

## Gospodarstwo bez wjazdu, ale mleko docelowo w przyczepie

Jeżeli gospodarstwo nie ma dostępu dla przyczepy, ale mleko ostatecznie ma trafić do komory przyczepy, musi najpierw zostać odebrane do sparowanej komory samochodu.

Przykład:
- docelowo komora 6,
- gospodarstwo nie ma wjazdu z przyczepą,
- mleko trafia najpierw do komory 3,
- później wykonywane jest 3 → 6.

Interfejs powinien pokazać:

**Docelowo 6 | teraz 3**

## Dzielenie gospodarstwa między komory

Zasada podstawowa:

Jeśli całe mleko z gospodarstwa mieści się w jednej dostępnej komorze, algorytm powinien umieścić je w jednej komorze.

Dzielenie jest dozwolone dopiero, gdy gospodarstwo nie mieści się w jednej dostępnej komorze.

Duże gospodarstwo może zostać podzielone na wiele komór.

Przykład:
- gospodarstwo 20 000 l może wymagać 4 lub więcej komór.

Algorytm powinien używać możliwie małej liczby komór.

Nie ma obowiązku wypełniania pierwszej komory do maksimum przed użyciem następnej. Liczy się wykonalność i jakość całego planu trasy.

## Łączenie gospodarstw

Mleko od różnych gospodarstw może znajdować się w tej samej komorze.

Nie jest wymagane, aby jedna komora była przypisana tylko do jednego gospodarstwa.

## Priorytety algorytmu

Algorytm porównuje możliwe plany według kilku kryteriów.

W uproszczeniu preferuje:
1. więcej mleka nalewanego bezpośrednio do przyczepy,
2. brak przepompowania, jeśli jest możliwy,
3. jeśli transfer jest potrzebny — jak najmniejszą liczbę przepompowanych par,
4. jak najmniej dzielonych gospodarstw,
5. większy praktyczny zapas w używanych komorach.

## Kara za zbyt mały zapas

W funkcji oceny planu wolne miejsce poniżej ok. **250 l** zwiększa karę planu.

To nie jest twardy zakaz, tylko preferencja używana do wyboru lepszego planu.

## Wyszukiwanie planu

Planner używa wyszukiwania stanów z ograniczeniem liczby zachowywanych wariantów.

Domyślny parametr:

```
beamWidth = 4000
```

Algorytm zachowuje różnorodność stanów:
- bez wykonanego transferu,
- po wykonanym transferze,

żeby nie odrzucić poprawnego planu tylko dlatego, że wcześniejsze warianty chwilowo wyglądały lepiej.

## Brak możliwego planu

Jeżeli przy danych:
- pojemnościach,
- prognozach,
- dostępie z przyczepą,
- rezerwie 65 l,
- zasadach transferu,

nie da się ułożyć poprawnej trasy, aplikacja ma powiedzieć, że plan jest niewykonalny.

Nie wolno tworzyć sztucznego planu przekraczającego pojemności.

Przykładowy komunikat:

```
Brak miejsca przy gospodarzu 24: ...
```

## Dane wyjściowe

Gotowy plan powinien pokazywać dla każdego gospodarstwa:
- numer kolejny,
- nazwę,
- prognozę litrów,
- dostęp z przyczepą,
- komorę lub komory,
- ilość litrów w każdej części,
- komorę bieżącą,
- komorę docelową po transferze.

Przepompowanie powinno być pokazane osobno, np.:

```
PRZEPOMPOWANIE po gospodarzu 10:
1 → 4: 4850 l
2 → 5: 5100 l
```

Na końcu aplikacja pokazuje podsumowanie wszystkich użytych komór:
- zaplanowane litry,
- pojemność użytkową,
- wolne miejsce.

## Przykład pojemności

Dla zestawu:

Samochód:
- 5300
- 5300
- 5300

Przyczepa:
- 5100
- 5000
- 6500

Pojemności użytkowe wynoszą:
- komora 1: 5235 l
- komora 2: 5235 l
- komora 3: 5235 l
- komora 4: 5035 l
- komora 5: 4935 l
- komora 6: 6435 l

Łącznie:

```
31410 l pojemności użytkowej
```

## Ustawianie liczby gospodarzy

W sekcji gospodarzy można wpisać liczbę gospodarzy na trasie i utworzyć dokładnie taką liczbę wierszy.

- zakres: 1–60 gospodarzy,
- zwiększenie liczby zachowuje już wpisane dane i dodaje puste wiersze,
- zmniejszenie liczby zachowuje pierwsze wiersze,
- jeśli usuwane dalsze wiersze zawierają dane, aplikacja prosi o potwierdzenie,
- przycisk „+ Dodaj wiersz” nadal dodaje pojedynczy wiersz i ma wizualną animację potwierdzającą kliknięcie.

## Tryb mobilny

Na małym ekranie lista gospodarstw zmienia się z szerokiej tabeli w pionowe karty.

Każda karta pokazuje:
- LP,
- nazwę,
- prognozę,
- dostęp przyczepy,
- przycisk usunięcia.

Jeśli przyczepa jest wyłączona, pola związane z dostępem przyczepy są ukrywane.

## Tryb offline

Wersja v1.14 jest przygotowana jako PWA.

Po pierwszym uruchomieniu przez HTTPS i instalacji na telefonie:
- aplikacja cache'uje potrzebne pliki,
- planner działa bez internetu,
- profile pojazdów są przechowywane lokalnie w urządzeniu,
- obliczenia są wykonywane lokalnie.

Service Worker używa cache:

```
milk-route-planner-v1.14
```

## OCR

OCR został na razie wyłączony w wersji offline.

Powód:
- wcześniejsza wersja korzystała z Tesseract.js pobieranego z CDN,
- rozpoznawanie zdjęć tras nie było jeszcze wystarczająco niezawodne,
- obecna wersja ma być naprawdę niezależna od internetu.

OCR może wrócić w przyszłości jako osobny moduł.

## Ograniczenia

Obecna wersja:
- obsługuje maksymalnie 3 komory samochodu i 3 komory przyczepy,
- obsługuje maksymalnie jeden punkt przepompowania,
- zakłada stałe pary 1→4, 2→5, 3→6,
- nie pozwala na częściowy transfer,
- nie zmienia kolejności gospodarstw,
- nie przewiduje automatycznie rzeczywistej ilości mleka ponad wpisaną prognozę,
- nie zastępuje kontroli fizycznego poziomu mleka i wskazań urządzeń podczas odbioru.

## Ważne praktycznie

Plan jest pomocą dla kierowcy.

Przed i podczas kursu należy nadal kontrolować:
- rzeczywiste ilości odebranego mleka,
- wskazania przepływomierza,
- wolne miejsce w komorach,
- możliwość fizycznego wjazdu zestawem,
- rzeczywistą konfigurację pojazdu i przyczepy.

## Skrócona specyfikacja

| Funkcja | Zasada |
|---|---|
| Samochód | komory 1–3 |
| Przyczepa | komory 4–6 |
| Rezerwa techniczna | 65 l na każdą komorę |
| Kolejność gospodarstw | zawsze stała |
| Wjazd z przyczepą TAK | dostęp do 1–6 |
| Wjazd z przyczepą NIE | dostęp tylko do 1–3 |
| Transfer | maks. 1 postój |
| Pary transferu | 1→4, 2→5, 3→6 |
| Transfer częściowy | niedozwolony |
| Duże gospodarstwo | może być dzielone |
| Małe gospodarstwo | preferowana 1 komora |
| Mieszanie gospodarstw | dozwolone |
| Bez przyczepy | tylko komory 1–3 |
| Offline | tak |
| OCR | wyłączony |

## Status

Aktualna wersja: **v1.14 Offline**
