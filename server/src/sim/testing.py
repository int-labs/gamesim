from scipy.stats import norm
import pandas as pd
import numpy as np

def calculate_decay_charge_off_table(delta_customers: int, risk_level: int) -> pd.DataFrame:
    std_dev = 0.17
    mean = 0.5

    # Charge-off boundaries
    start = 0.35
    end = 0.02
    
    # Split piecewise decay steps
    mid_index = 10
    top_range = range(0, mid_index + 1)     # 0–10
    bottom_range = range(mid_index + 1, 21) # 11–20

    # Adjust decay rates
    slow_decay_step = 0.15
    fast_decay_step = 0.3

    # Generate piecewise decay
    decay_factors = []
    for i in top_range:
        factor = end + (start - end) * (1 + slow_decay_step) ** (-i)
        decay_factors.append(factor)

    last_value_top = decay_factors[-1]

    for j, i in enumerate(bottom_range):
        factor = end + (last_value_top - end) * (1 + fast_decay_step) ** (-(j + 1))
        decay_factors.append(factor)

    # Normal distribution for customer count
    norm_dists = []
    for i in range(21):
        freq_pct = i * 0.05
        norm_dist_pdf = norm.pdf(freq_pct, loc=mean, scale=std_dev)
        norm_dists.append(norm_dist_pdf)

    total_norm_dist = sum(norm_dists)

    rows = []
    total_customer_count = 0
    total_charge_off_weighted = 0

    for i in range(21):
        freq_pct = i * 0.05
        norm_dist_pdf = norm_dists[i]
        norm_dist_percent = norm_dist_pdf / total_norm_dist
        customer_count = delta_customers * norm_dist_percent
        total_customer_count += customer_count

        charge_off_pct = decay_factors[i] * 100
        total_charge_off_weighted += charge_off_pct * customer_count

        rows.append({
            "Minimum Credit": i,
            "Frequency": f"{int(freq_pct * 100)}%",
            "NORMDIST": f"{(norm_dist_pdf * 100):.1f}%",
            "Customer Count": f"{customer_count:,.0f}",
            "Expected Charge-offs": f"{charge_off_pct:.2f}%"
        })

    weighted_avg_charge_off_pct = total_charge_off_weighted / delta_customers
    rows.append({
        "Minimum Credit": "Total",
        "Frequency": "",
        "NORMDIST": "100.0%",
        "Customer Count": f"{round(total_customer_count):,}",
        "Expected Charge-offs": f"{weighted_avg_charge_off_pct:.2f}%"
    })

    return pd.DataFrame(rows)

# Run example
if __name__ == "__main__":
    df = calculate_decay_charge_off_table(
        delta_customers=801129,
        risk_level=9
    )
    print(df.to_string(index=False))
