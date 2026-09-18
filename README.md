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

Planner najpierw próbuje policzyć całą trasę bez żadnego przepompowania. Jeżeli taki plan jest wykonalny, ma pierwszeństwo bez względu na inne preferencje. Dopiero gdy plan bez transferu jest niewykonalny, planner może szukać wariantu z jednym przepompowaniem.

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

Jeżeli odbiór mieści się w jednej pustej dostępnej komorze, planner nie może dzielić tego gospodarstwa między kilka komór. Musi znaleźć taki układ wcześniejszych odbiorów, aby całe mleko tego gospodarstwa trafiło do jednej komory. Podział jest dozwolony dopiero wtedy, gdy ilość mleka jest większa niż pojemność każdej pojedynczej dostępnej komory.

Duże gospodarstwa mogą być używane do dopełniania już częściowo zajętych komór. Planner przy rankingu wariantów zachowuje wolną pojedynczą komorę dla późniejszych mniejszych gospodarstw, zamiast rozdrabniać mały odbiór między kilka komór.

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

W sekcji gospodarzy można wpisać liczbę gospodarzy na trasie i utworzyć dokładnie taką liczbę wierszy. Przed kliknięciem „Utwórz listę” lista gospodarzy oraz kontrolki zależne od niej są ukryte.

- zakres: 1–60 gospodarzy,
- zwiększenie liczby zachowuje już wpisane dane i dodaje puste wiersze,
- zmniejszenie liczby zachowuje pierwsze wiersze,
- jeśli usuwane dalsze wiersze zawierają dane, aplikacja prosi o potwierdzenie,
- przycisk „+ Dodaj wiersz” nadal dodaje pojedynczy wiersz i ma wizualną animację potwierdzającą kliknięcie.

## Szybkie wpisywanie prognoz

Podczas wpisywania litrów można nacisnąć **Enter / Dalej w polu prognozy**, aby automatycznie przejść do pola prognozy następnego gospodarza. Pola używają `enterkeyhint="next"`, aby działało to również wygodniej na klawiaturze ekranowej telefonu.

## Potwierdzanie usuwania

Usuwanie gospodarza korzysta z własnego okna potwierdzenia w interfejsie zamiast systemowego okna przeglądarki. Okno pokazuje numer i nazwę gospodarza oraz przyciski „Anuluj” i „Usuń gospodarza”.

## Nieaktualny plan

Po poprawnym obliczeniu planu każda zmiana danych mających wpływ na trasę oznacza wynik jako **„Plan nieaktualny”**. Nad starym wynikiem pojawia się żółty komunikat i przycisk „Policz ponownie”. Stary plan pozostaje widoczny, ale jest przygaszony do czasu ponownego obliczenia.

## Podsumowanie trasy na żywo

Pod listą gospodarzy aplikacja pokazuje liczbę gospodarzy, sumę wpisanych prognoz oraz liczbę gospodarstw z możliwością wjazdu z przyczepą. Odbiory od 4000 l są delikatnie wyróżniane.

Przycisk „Wyczyść trasę” usuwa dane bieżącej trasy i wynik planowania, ale nie usuwa zapisanych profili pojazdów.

Przed wynikiem obliczenia aplikacja pokazuje krótkie podsumowanie danych użytych do planu.

Jeśli błąd planowania zawiera numer gospodarza, aplikacja automatycznie przewija do odpowiedniego wiersza i chwilowo go wyróżnia.

## Tryb kierowcy

Po poprawnym policzeniu trasy pojawia się przycisk „Tryb kierowcy”. Otwiera pełnoekranowy, uproszczony widok zawierający tylko:
- numer gospodarza,
- prognozowaną ilość litrów,
- komorę lub komory odbioru,
- informację „teraz → docelowo”, jeśli mleko ma być przepompowane,
- osobno wyróżniony moment przepompowania.

Tryb kierowcy nie pokazuje ustawień ani pól edycji. Przycisk „Wróć do edycji” zamyka widok i wraca do pełnego planera.

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

Wersja v1.33 jest przygotowana jako PWA.

Po pierwszym uruchomieniu przez HTTPS i instalacji na telefonie:
- aplikacja cache'uje potrzebne pliki,
- planner działa bez internetu,
- profile pojazdów są przechowywane lokalnie w urządzeniu,
- obliczenia są wykonywane lokalnie.

Service Worker używa cache:

```
milk-route-planner-v1.33
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

Aktualna wersja: **v1.33 Offline**


## Zasada napełniania dużego gospodarstwa

Przy dużym gospodarstwie każda komora wybrana przed ostatnią musi zostać dopełniona do swojej pojemności roboczej. Dopiero ostatnia komora może pozostać niepełna, gdy kończy się mleko u gospodarza. Planner może użyć jednej dodatkowej komory ponad minimum, jeśli jest to potrzebne, aby zachować późniejsze odbiory w pojedynczych komorach i uniknąć przepompowania.


## Praktyczny margines przy odbiorze

Dla gospodarstwa mieszczącego się w jednej komorze planner preferuje co najmniej 300 l praktycznego marginesu po odbiorze, jeżeli istnieje wykonalny wariant z takim zapasem. Dokładne dopełnienie komory do 0 l wolnego jest dozwolone; unikane są ciasne reszty od 1 do 299 l.


## Patrzenie do przodu

Podczas wyboru wariantu planner wykonuje krótką symulację kilku kolejnych mniejszych odbiorów. Preferuje wcześniejsze ułożenie komór, które pozwala późniejszym gospodarstwom wejść w pojedyncze komory z praktycznym marginesem, zamiast dopiero na końcu odkrywać brak bezpiecznego miejsca.


## Minimalna liczba przepompowań

Planner najpierw próbuje ułożyć trasę bez przepompowania. Jeśli to niemożliwe, zwiększa dopuszczalną liczbę przepompowań kolejno do 1, 2, 3 itd. i wybiera pierwszy wykonalny wariant. Każde przepompowanie nadal działa wyłącznie parami 1→4, 2→5 i 3→6, a zawartość wybranej komory auta jest przenoszona w całości.


## Pierwszeństwo większego gospodarza do jedynej dużej komory

Jeżeli dwa gospodarstwa konkurują o tę samą jedyną komorę, która może pomieścić cały ich odbiór, większy gospodarz ma pierwszeństwo do tej komory. Mniejszy może zostać rozdzielony po mniejszych komorach, z zachowaniem zasady ciągłego napełniania: komora jest dopełniana przed przejściem do następnej, a tylko ostatnia może zostać niepełna.


## Wydajność planowania

Od v1.33 obliczenia planu działają w osobnym wątku Worker, dzięki czemu trudna trasa nie blokuje interfejsu aplikacji. Domyślna szerokość wyszukiwania została ograniczona z 4000 do 1200 najlepszych stanów, a krótkie patrzenie do przodu zachowuje mniej równoważnych wariantów.
