import { createTheme } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    active: Palette["primary"];
    completed: Palette["primary"];
  }
  interface PaletteOptions {
    active?: PaletteOptions["primary"];
    completed?: PaletteOptions["primary"];
  }
}
declare module "@mui/material/Button" {
  interface ButtonPropsSizeOverrides {
    fortySix: true;
  }
}
declare module "@mui/material/Chip" {
  interface ChipPropsColorOverrides {
    active: true;
    completed: true;
  }
  interface ChipPropsSizeOverrides {
    smallMedium: true;
  }
}

const theme = createTheme({
  typography: {
    fontFamily: '"Inter", Arial, sans-serif',
  },
  palette: {
    active: {
      main: "rgba(30, 64, 175, 1)", // blue
      contrastText: "#fff",
    },
    completed: {
      main: "rgba(17, 94, 89, 1)", // green
      contrastText: "#fff",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: '"Inter", Arial, sans-serif',
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          // global disabled style for all buttons
          "&.Mui-disabled": {
            color: "rgba(255, 255, 255, 0.6)", // white but a bit gray
            opacity: 0.6, // make background transparent in disabled state
          },
        },
        containedPrimary: {
          color: "#fff",
          backgroundImage:
            "linear-gradient(0deg, #F9137D, #F9137D), linear-gradient(180deg, rgba(255, 255, 255, 0.24) 0%, rgba(249, 19, 125, 0.24) 100%)",
          border: "2.5px solid rgba(0, 0, 0, 0.12)",
          boxShadow:
            "0px 1px 1px 0px rgba(0, 0, 0, 0.06), 0px 1px 2px 0px rgba(0, 0, 0, 0.1)",
          textTransform: "none",
          fontWeight: 600,
          "&:hover": {
            boxShadow:
              "0px 2px 4px rgba(0, 0, 0, 0.08), 0px 4px 8px rgba(0, 0, 0, 0.12)",
          },
          borderRadius: "12px",
          // special disabled style for containedPrimary
          "&.Mui-disabled": {
            color: "rgba(255, 255, 255, 0.6)",
            opacity: 0.6, // make background transparent in disabled state
          },
        },
        outlinedPrimary: {
          color: "rgba(249, 19, 125, 1)", // pink text
          borderColor: "rgba(249, 19, 125, 1)", // pink border
          textTransform: "none",
          fontWeight: 600,
          borderRadius: "12px",
          "&:hover": {
            borderColor: "rgba(249, 19, 125, 1)",
            backgroundColor: "rgba(249, 19, 125, 0.04)", // subtle pink hover bg
          },
          "&.Mui-disabled": {
            color: "rgba(249, 19, 125, 0.4)",
            borderColor: "rgba(249, 19, 125, 0.3)",
            opacity: 0.6, // make background transparent in disabled state
          },
        },
        textPrimary: {
          color: "rgba(249, 19, 125, 1)", // pink text
          textTransform: "none",
          fontWeight: 600,
          borderRadius: "12px",
          "&:hover": {
            backgroundColor: "rgba(249, 19, 125, 0.04)", // subtle pink hover bg
          },
          "&.Mui-disabled": {
            color: "rgba(249, 19, 125, 0.4)",
            opacity: 0.6, // make background transparent in disabled state
          },
        },
      },
      variants: [
        {
          props: { size: "fortySix" }, // Defining a new 'xl' size
          style: {
            padding: "14px 16px",
            fontSize: "15px",
            lineHeight: "100%",
          },
        },
      ],
    },

    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: "rgba(33, 28, 132, 1)", // selected underline
          height: 3,
          borderRadius: 3,
        },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          color: "rgba(156, 163, 175, 1)", // unselected
          textTransform: "none",
          fontSize: "18px",
          lineHeight: "100%",
          letterSpacing: "0.5%",
          fontWeight: 600,
          "&.Mui-selected": {
            color: "rgba(33, 28, 132, 1)", // selected
          },
        },
      },
    },

    MuiTable: {
      styleOverrides: {
        root: {
          border: "1px solid var(--Table-Border-Color, rgba(229, 231, 235, 1))",
          borderCollapse: "separate",
          borderRadius: "12px",
          borderSpacing: 0,
        },
      },
    },

    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head:first-of-type": { borderTopLeftRadius: 12 },
          "& .MuiTableCell-head:last-of-type": { borderTopRightRadius: 12 },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: "rgba(226, 232, 240, 1)", // same as above or omit if using TableHead root
          color: "rgba(107, 114, 128, 1)", // header text color
          fontWeight: 600,
          fontSize: "16px",
          lineHeight: "24px",
          letterSpacing: "0.5%",
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: "6px",
          height: "18px",
          fontSize: "10px",
          lineHeight: "16px",
          letterSpacing: "0.5%",
        },
      },
      variants: [
        {
          props: { color: "active" },
          style: {
            backgroundColor: "rgba(219, 234, 254, 1)",
            color: "rgba(30, 64, 175, 1)",
            "&:hover": {
              backgroundColor: "rgba(219, 234, 254, 0.8)",
            },
            "&:active": {
              backgroundColor: "rgba(219, 234, 254, 0.8)",
            },
            "&:focus": {
              backgroundColor: "rgba(219, 234, 254, 0.8)",
            },
          },
        },
        {
          props: { color: "completed" },
          style: {
            backgroundColor: "rgba(204, 251, 241, 1)",
            color: "rgba(17, 94, 89, 1)",
          },
        },
        {
          props: { size: "smallMedium" },
          style: {
            height: "28px",
            fontSize: "12px",
            lineHeight: "16px",
            letterSpacing: "0.5%",
          },
        },
      ],
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          borderRadius: "4px",
          "&.Mui-checked": {
            color: "rgba(249, 19, 125, 1)",
          },
          "&.MuiCheckbox-indeterminate": {
            color: "rgba(249, 19, 125, 1)",
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "white",
          height: "47px",
          fontSize: "15px",
          lineHeight: "100%",
          letterSpacing: "0.5%",
          color: "rgba(3, 7, 18, 1)",
          borderRadius: "8px",
          border: "1px solid rgba(229, 231, 235, 1)",
          "& input": {
            padding: "14px 16px",
          },
          "&.MuiInputBase-multiline": {
            height: "auto",
            padding: "14px 16px",
          },
          "&.Mui-disabled": {
            backgroundColor: "rgba(229, 231, 235, 1)",
            "& fieldset.MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(229, 231, 235, 1)",
            },
          },
        },
      },
      variants: [
        {
          props: { disabled: true },
          style: {
            "& .MuiInputBase-input.Mui-disabled": {
              WebkitTextFillColor: "rgba(107, 114, 128, 1)",
            },
          },
        },
      ],
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          height: "47px",
        },
        select: {
          height: "15px",
          minHeight: "unset",
          fontSize: "15px",
          lineHeight: "100%",
          padding: "14px 16px",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: "white",
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: "24px",
          padding: "32px",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: "0px",
          fontSize: "30px",
          lineHeight: "45px",
          letterSpacing: "0.15px",
          fontWeight: 600,
          color: "rgba(0, 0, 0, 1)",
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: "12px 0px 32px 0px",
          "&.MuiDialogContent-root": {
            paddingTop: "12px",
          },
          "& .MuiTypography-root": {
            fontSize: "18px",
            lineHeight: "100%",
            letterSpacing: "0.15px",
            color: "rgba(0, 0, 0, 1)",
          },
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: "0px",
        },
      },
    },
  },
});

export default theme;
