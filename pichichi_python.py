import requests
import time
import os

API_TOKEN = os.environ["API_BZZOIRO"]

LIGA = 3
TEMPORADA = 1307

HEADERS = {
    "Authorization": f"Token {API_TOKEN}",
    "Accept": "application/json"
}


def pedir(url):

    respuesta = requests.get(
        url,
        headers=HEADERS,
        timeout=20
    )

    if respuesta.status_code != 200:
        print(f"ERROR HTTP {respuesta.status_code}: {url}")
        return None

    return respuesta.json()


# ---------------------------------------------------------
# 1. OBTENER PICHICHI
# ---------------------------------------------------------

inicio = time.time()

url_pichichi = (
    f"https://sports.bzzoiro.com/api/v2/leagues/"
    f"{LIGA}/top/scorers/"
)

datos = pedir(url_pichichi)

if not datos or "leaders" not in datos:
    print("ERROR obteniendo clasificación de goleadores")
    exit()

leaders = datos["leaders"]

if not leaders:
    print("No hay datos de goleadores")
    exit()


# ---------------------------------------------------------
# 2. BUSCAR EL MÁXIMO DE GOLES
# ---------------------------------------------------------

max_goles = max(
    jugador["value"]
    for jugador in leaders
)


# ---------------------------------------------------------
# 3. OBTENER TODOS LOS PICHICHIS EMPATADOS
# ---------------------------------------------------------

pichichis = [
    jugador
    for jugador in leaders
    if jugador["value"] == max_goles
]


# ---------------------------------------------------------
# 4. MOSTRAR SOLO PICHICHI / PICHICHIS
# ---------------------------------------------------------

print()
print("=" * 70)

if len(pichichis) == 1:
    print("PICHICHI")
else:
    print("PICHICHIS EMPATADOS")

print("=" * 70)

for jugador in pichichis:

    print(
        f"{jugador['player_name']} "
        f"({jugador['team_name']}) - "
        f"{jugador['value']} goles | "
        f"{jugador['matches']} partidos | "
        f"ID jugador: {jugador['player_id']} | "
        f"ID equipo: {jugador['team_id']}"
    )


# ---------------------------------------------------------
# 5. TIEMPO TOTAL
# ---------------------------------------------------------

fin = time.time()

print()
print("=" * 70)
print(f"Tiempo total: {fin - inicio:.2f} segundos")
print("=" * 70)
