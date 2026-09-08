import React from "react";

// ============================================================
// PAGINATION
// ============================================================

const Pagination = ({
  currentPage = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
}) => {

  // ==========================================================
  // TOTAL PAGES
  // ==========================================================

  const totalPages = Math.max(
    1,
    Math.ceil(
      totalItems / itemsPerPage
    )
  );


  // ==========================================================
  // NO PAGINATION REQUIRED
  // ==========================================================

  if (
    totalItems === 0 ||
    totalPages <= 1
  ) {
    return null;
  }


  // ==========================================================
  // SAFE CURRENT PAGE
  // ==========================================================

  const safeCurrentPage = Math.min(
    Math.max(
      Number(currentPage) || 1,
      1
    ),
    totalPages
  );


  // ==========================================================
  // PAGE NUMBERS
  // ==========================================================

  const pages = [];

  for (
    let page = 1;
    page <= totalPages;
    page++
  ) {
    pages.push(page);
  }


  // ==========================================================
  // DISPLAY INFORMATION
  // ==========================================================

  const startItem =
    (safeCurrentPage - 1) *
      itemsPerPage +
    1;

  const endItem = Math.min(
    safeCurrentPage *
      itemsPerPage,
    totalItems
  );


  // ==========================================================
  // PAGE CHANGE
  // ==========================================================

  const goToPage = (page) => {

    if (
      page < 1 ||
      page > totalPages ||
      page === safeCurrentPage
    ) {
      return;
    }

    if (
      typeof onPageChange ===
      "function"
    ) {
      onPageChange(page);
    }

  };


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="pagination">

      {/* ====================================================
          PAGINATION INFORMATION
      ===================================================== */}

      <div className="paginationInfo">

        Showing{" "}

        <b>
          {startItem}
        </b>

        {" – "}

        <b>
          {endItem}
        </b>

        {" of "}

        <b>
          {totalItems}
        </b>

      </div>


      {/* ====================================================
          PAGINATION CONTROLS
      ===================================================== */}

      <div className="paginationControls">

        {/* PREVIOUS */}

        <button
          type="button"
          className="paginationButton"
          disabled={
            safeCurrentPage === 1
          }
          onClick={() =>
            goToPage(
              safeCurrentPage - 1
            )
          }
        >
          Previous
        </button>


        {/* PAGE NUMBERS */}

        <div className="paginationPages">

          {pages.map(
            (page) => (

              <button
                key={page}
                type="button"
                className={
                  page ===
                  safeCurrentPage
                    ? "paginationButton active"
                    : "paginationButton"
                }
                onClick={() =>
                  goToPage(page)
                }
              >
                {page}
              </button>

            )
          )}

        </div>


        {/* NEXT */}

        <button
          type="button"
          className="paginationButton"
          disabled={
            safeCurrentPage ===
            totalPages
          }
          onClick={() =>
            goToPage(
              safeCurrentPage + 1
            )
          }
        >
          Next
        </button>

      </div>

    </div>
  );
};


export default Pagination;