const createHistory = async ({
    site,
    submission = null,
    action,
    actionBy,
    actionByRole,
    remarks = "",
    oldStatus,
    newStatus
}) => {

    // =========================================
    // SITE SNAPSHOT
    // =========================================

    const siteSnapshot = {
        site_code: site.site_code,
        state: site.state,
        zone: site.zone,
        media_type: site.media_type,
        duration: site.duration,
        location: site.location,
        type: site.type,
        unit: site.unit,
        width: site.width,
        height: site.height,
        total_sqr_ft: site.total_sqr_ft,
        lat: site.lat,
        long: site.long,
        vendor: site.vendor,
        availability: site.availability,
        remarks: site.remarks,
        start_date: site.start_date,
        end_date: site.end_date,

        assigned_vendor_executive:
            site.assigned_vendor_executive || null,

        assigned_state_head:
            site.assigned_state_head || null,

        assigned_client:
            site.assigned_client || null,

        status: site.status
    };


    // =========================================
    // SUBMISSION SNAPSHOT
    // =========================================

    let submissionSnapshot = null;

    if (submission) {

        submissionSnapshot = {
            _id: submission._id,

            person_name:
                submission.person_name || "",

            selfie:
                submission.selfie || "",

            site_images:
                submission.site_images || [],

            uploaded_by:
                submission.uploaded_by || null,

            uploader_role:
                submission.uploader_role || "",

            uploaded_at:
                submission.createdAt || new Date()
        };
    }


    // =========================================
    // HISTORY ENTRY
    // =========================================

    const historyEntry = {

        submission:
            submission?._id || null,

        action,

        action_by:
            actionBy?._id || null,

        action_by_role:
            actionByRole || "",

        action_by_name:
            actionBy?.name || "",

        remarks,

        old_status:
            oldStatus || null,

        new_status:
            newStatus || null,

        site_snapshot:
            siteSnapshot,

        submission_snapshot:
            submissionSnapshot,

        created_at:
            new Date()
    };


    // =========================================
    // LATEST FIRST
    // =========================================

    site.history =
        site.history || [];

    site.history.unshift(
        historyEntry
    );


    // =========================================
    // SAVE
    // =========================================

    await site.save();


    return historyEntry;
};


module.exports = {
    createHistory
};