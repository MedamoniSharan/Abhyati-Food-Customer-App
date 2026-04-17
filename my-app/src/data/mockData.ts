import type { Order, Product } from '../types/app'

export const categories = ['All Items', 'Eco-Friendly', 'Party Packs', 'Bamboo', 'Heavy Duty'] as const

export const products: Product[] = [
  {
    id: 1,
    name: 'Bio-Degradable 9" Dinner Plates',
    subtitle: 'Pack of 500 units',
    priceInr: 3199,
    oldPriceInr: 3699,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCZ8sZyKQLdmvrxi-pc3utIDex0iy8C0Mea7GK3I_qVqBeEiQZ52oyujlnYXu8FbF7ENTTxcxGaeGj9RR6fAV1dZZS-TPsHC-AQBDIRj2xVTBBQHumDvD-NjtqD515t6aLAoF-jcqQPbrCFNdB5yR4wIJb1YOUZzzH8QdT06atpIVkRkKjIZy9Ds-ka5110xINvag4zYKuogGyFrClkqmh1umOao8nR302mLEm_rEXtPbH4vybHy3TL83oTF24hM5eBot8Ati-FpzUW',
    badge: { label: 'Eco', tone: 'green' },
    category: 'Eco-Friendly',
  },
  {
    id: 2,
    name: 'Premium Party Pack Assorted Colors',
    subtitle: 'Pack of 200 units',
    priceInr: 2079,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBlBo6iqXXWh2UvtxnYw1Uwhq98yUWD9vXajXFL69ylEtlAMPJMZnNIgnI1WGRWzTSFJHhApbFD_ECyPEKWS-TaksY8WM4SzLTF6kP7fu56t2miFDo8JDIgclycqi_hXKKwul1bJXCYkSL6QZnggR2ZPyO5iW8ffknfLHAI5bEx_U7bjriIWrZgT0qYKsCV5RAY8OCsqbpgG0ahoP7S1T1pVCg3hS7_89U9oy1du0b2Wce34fGpUw9tzPVy3I0AnWmmJ2zxDA8f6sAI',
    badge: { label: 'Sale', tone: 'red' },
    category: 'Party Packs',
  },
  {
    id: 3,
    name: 'Heavy Duty Bamboo Square Plates',
    subtitle: 'Case of 1000 units',
    priceInr: 9990,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA6pO1m2kmcZPvpc_PUNbBO0kd9iFUByP6r1DLqh9flsiTLjRd_afLF5RysqFcHJ-SJTqt1kPiCaNTmU5GyoeRl1BHGxCPROf600XGas9yb_8D0i4eOgsh4UxoPUu7ph2h9T08F3SK8JEzWBuAz6UgazyxuD6SX0jdpfeOaX8IXY9K3UwWYdxHfWDHa-zXGgVJUZUe1eFDiobg1Q3XyqhLHoG9NtBH6QZ-OC448Jt1_O8LojQ8YfrsyUACABjRqxLYlSqMNmHec7pG7',
    category: 'Bamboo',
  },
  {
    id: 4,
    name: 'Standard 12oz Disposable Bowls',
    subtitle: 'Pack of 500 units',
    priceInr: 2390,
    oldPriceInr: 2650,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDHNed4yt2IXxzmKpnm0_AY1rHS863Vze7tyeoiSTO-ZMCHEiRC2w89hGGWz_pZ_-vRS4jBXuOGoWtdambJJRqgm1am7g1q47vj0skkB-UsZz9S9EMF-0Nx-QRC2lt3kOeMwlyC4wiaHkqyS7LXhExODdaWiZneMRJ1c8nbdAFnrww8E_UigoN8K3rN4Xp07GsQjnLnnZKF1j_mEQ1NO3G4vBiEkhsRPUT619-say9EIOHOXRM7OGPiN-7nptsBOgie4y8ov7Jy57H3',
    category: 'Heavy Duty',
  },
  {
    id: 5,
    name: 'Elegant Gold Rim Plastic Plates',
    subtitle: 'Pack of 50 units',
    priceInr: 3560,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC8tABBwGITsakKaRJzxvnRHpunNmiwVekGNH5C26oxI29H2RXXVYt26UO_97eZ-RLu7BnlvUKcdGScYkiCxi9KyMlpRjPZY8unbv2ukT9HZgaSc6O7Ll2NXLtNQ6U4qJSfZ2RrguSs8hPrPSmwZOvJs1MZepF5FZ-ZF50Ka4dqGKBdKNe0suky-CJT3MTbPaCQxVycfEzYo99jIW1NIHDl-RVFc3QX5nQl0ot8scd1jgSg_YdkPM83Uvk0_FDdJLL6tA-tZcT2_prl',
    category: 'Premium',
  },
  {
    id: 6,
    name: 'Palm Leaf Square Plates',
    subtitle: 'Pack of 100 units',
    priceInr: 4580,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCdVT6U0Pl0aNtjDiWD5k6wLrc6Ldqyxsw7ecouhgw5zY8CUdzoe52qhdYkA9E2QH-hePzUPko_RKHTekcvLJ0PBBBcgFNF-byqo0GNiEny3D1ez-NdsU7Kq7PLOGjcbw-jGOGzMHyGsRz3hjbVFkZKv0ZBKEMBESn6SD7OllfTEQIHuGmdQMx6bOm9LrACpGZ8hC8YCvF0TdAq4PeJ5PMl6w2VfedQNvoJaYvb99h7nWBMwazWmsAifsM0buJa7p6bT7vFEelpUBT6',
    badge: { label: 'Natural', tone: 'green' },
    category: 'Eco-Friendly',
  },
]

export const orders: Order[] = [
  {
    id: '83210',
    date: '24 Oct 2023',
    status: 'Shipped',
    items: '10,000x 9" Bio-degradable Plates, 5,000x Paper Cups',
    amountInr: 103250,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBqvQvTyvLp4LZlIuakG6a4Z35ynkcxCWD6-w7E5Xo7ZU_A_iSzgxO40ZrC2A3aWdJKt02Pweb5usCpGpB9GUD2C6LJ5pnmstZ_OXgyPLH44owA8T5nXnaIWtYd1O88GERGiH6eq_4zQvSWTKZMYQrhoI5DT0iDj1JOwZbBXfnWYdNRH52xu7uJOD78-7A-U4WO6Fuo-_cb7Wuzplm0ax5GK5ufmgGhcjEfQZRglf4RnjzM8fJEnLuXklDBvebtMPuWPhkQiXk6rUem',
  },
  {
    id: '83215',
    date: '26 Oct 2023',
    status: 'Processing',
    items: '25,000x Bulk Dinner Napkins',
    amountInr: 70850,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCAoJJUKPFBVwL6C4t1B-sfM3fyAS8SleST6pMTZwlHzY7kJV135eIlXacReZtCIVMkqh7VZImoXWrFCN5S15wVqAzPKRmb94z_-09LK-mPbsD4bk8bvjG_LY-fFHsA95ft2EjM7iZiGHqHKiOQSftvzI4VjXs4wlJGQPtSaLnBUN_jNE9AckQSFGv9_VYUySb0GY7VHlPAiEaD3hbl4YO_B5TkC-ZawQ3cawal1sbyrsRZvwfYrGchaHKGt2XlpC8L5oAbALAqCqSl',
  },
  {
    id: '83150',
    date: '15 Oct 2023',
    status: 'Delivered',
    items: '50x Cases Heavy Duty Plates',
    amountInr: 175000,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDMnn1q0n-FFhbvSyUqAT82d_NcNZ0WZgxPqFOiRMnlFJYjfHvY9JMkHXCKInxGj1grOvmKw0lC487ra8mkhrAXuUpz1jcosXXBAYIYTX7pVCVJZfmoEYTFAtAAF3Zzlpg-KJCbOxgz7I5_0hcGZCp_D8LCA5Vh6m5wl3eoLZJeP29xI1WcCgtMKqsRiHNoHGmdFtisSxN75C-UDKImx88grkhw6wFzwfHR2e234aYEEmwa6UxvNh_ESAm0tAe7IXzMdLIg0A0AcTpM',
  },
]
